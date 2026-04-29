/**
 * `harness` CLI entry point — single-binary wrapper exposing every
 * ported subsystem as `harness <subcommand>` (F-104).
 *
 * Slash commands shell out here. Each subcommand maps to a single
 * module under `src/` (`work`, `sync`, `check`, `status`, `events`,
 * `metrics`, `validate`, `inbox`).
 *
 * Exit codes:
 *
 *   - `0` — success
 *   - `2` — IO / setup error
 *   - `3` — invalid argument
 *   - `5` — schema validation error
 *   - `6` — drift detected (`harness check`)
 *   - `7` — gate failed (`harness work --run-gate`)
 *
 * @module cli/harness
 */

import {existsSync, statSync} from 'node:fs';
import {join, resolve as resolvePath} from 'node:path';

import {Command} from 'commander';

import {generateDesignReview} from '../ceremonies/designReview.js';
import {
  agentsForShapes as kickoffAgentsForShapes,
  detectShapes as kickoffDetectShapes,
  generateKickoff,
  hasAudioFlag as kickoffHasAudioFlag,
  renderStyleBlock as kickoffRenderStyleBlock,
} from '../ceremonies/kickoff.js';
import {generateRetro} from '../ceremonies/retro.js';
import {openQuestions, scanInbox} from '../ceremonies/inbox.js';
import {parse as yamlParseSpec} from 'yaml';
import {readFileSync as readSpecFile, statSync as statSpecFile} from 'node:fs';
import {resolveMode} from '../core/projectMode.js';
import {formatHuman as formatCheckHuman, runCheck} from '../check.js';
import {filterEvents, formatHuman as formatEventsHuman} from '../events.js';
import {readEvents} from '../core/eventLog.js';
import {compute as computeMetrics, formatHuman as formatMetricsHuman} from '../metrics.js';
import {render as renderDashboard} from '../ui/dashboard.js';
import {suggest} from '../ui/intentPlanner.js';
import {resolveLang} from '../ui/lang.js';
import {SpecValidationError, loadSpec, validate as validateSpec} from '../spec/validate.js';
import {State} from '../core/state.js';
import {buildReport, formatHuman as formatStatusHuman} from '../status.js';
import {parse as yamlParse} from 'yaml';
import {readFileSync} from 'node:fs';
import {run as runSync, tryInitialSync} from '../sync.js';
import {
  activate,
  addEvidence,
  archive,
  block,
  complete,
  current,
  deactivate,
  recordGate,
  removeFeature,
  runAndRecordGate,
  type WorkResult,
} from '../work.js';
import type {GateResult} from '../core/state.js';

function printHuman(text: string): void {
  process.stdout.write(text);
}

function printJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function printError(message: string): void {
  process.stderr.write(`${message}\n`);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function resolveHarnessDir(opt: string | undefined): string {
  return resolvePath(opt ?? join(process.cwd(), '.harness'));
}

function workResultToJson(r: WorkResult): Record<string, unknown> {
  return {
    feature_id: r.feature_id,
    action: r.action,
    current_status: r.current_status,
    gates_passed: r.gates_passed,
    gates_failed: r.gates_failed,
    evidence_count: r.evidence_count,
    message: r.message,
    routed_agents: r.routed_agents,
    parallel_groups: r.parallel_groups,
  };
}

function formatWorkHuman(r: WorkResult): string {
  const lines: string[] = [];
  lines.push(`🛠  /harness:work · ${r.action} · ${r.feature_id}`);
  lines.push('');
  lines.push(`status: ${r.current_status}`);
  if (r.gates_passed.length > 0) {
    lines.push(`passed: ${r.gates_passed.join(', ')}`);
  }
  if (r.gates_failed.length > 0) {
    lines.push(`failed: ${r.gates_failed.join(', ')}`);
  }
  lines.push(`evidence: ${r.evidence_count} entries`);
  if (r.message) {
    lines.push('');
    lines.push(r.message);
  }
  if (r.routed_agents.length > 0) {
    lines.push('');
    lines.push(`routed agents: ${r.routed_agents.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

function emitWork(result: WorkResult, json: boolean): void {
  if (json) {
    printJson(workResultToJson(result));
  } else {
    printHuman(formatWorkHuman(result));
  }
}

function buildProgram(): Command {
  const program = new Command();
  program
    .name('harness')
    .description('Multi-agent development harness — TS CLI for Claude Code plugin')
    .version('0.13.1');

  // -----------------------------------------------------------------
  // work
  // -----------------------------------------------------------------
  const work = program
    .command('work')
    .description('feature lifecycle (activate / gate / evidence / complete / dashboard)')
    .argument('[feature]', 'feature id (e.g. F-001) — omitted invokes the dashboard')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--current', 'show the active feature (read-only)')
    .option('--gate <name> <result>', 'record a gate result manually (legacy 2-arg form)')
    .option('--run-gate <name>', 'auto-run a gate via the gate runner and record the result')
    .option('--project-root <dir>', 'cwd for --run-gate (default: harness-dir parent)')
    .option('--override-command <cmd>', 'override gate command (space-separated)')
    .option('--timeout <sec>', 'timeout for --run-gate', '300')
    .option('--note <text>', 'note for --gate', '')
    .option('--evidence <summary>', 'add an evidence row with this summary')
    .option('--kind <kind>', 'kind for --evidence or --block', 'generic')
    .option('--block <reason>', 'mark feature as blocked with this reason')
    .option('--complete', 'transition to done (Iron Law applies)')
    .option('--hotfix-reason <reason>', 'override Iron Law evidence floor with audited reason')
    .option('--archive', 'transition done → archived')
    .option('--superseded-by <fid>', 'feature id replacing this archived feature')
    .option('--reason <text>', 'archive reason')
    .option('--deactivate', 'clear session.active_feature_id only')
    .option('--remove <fid>', 'remove a non-done feature from state.yaml')
    .option('--kickoff', 'force-regenerate the kickoff template (idempotency override)')
    .option('--design-review', 'force-regenerate the design-review template')
    .option('--retro', 'force-regenerate the retro template')
    .option('--no-fog', 'skip the F-037 fog-clear auto-wire on activate')
    .option('--json', 'emit JSON instead of human-readable text')
    .action((feature: string | undefined, options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      const json = Boolean(options['json']);
      if (!isDirectory(harnessDir)) {
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }

      // --remove handles its own feature id arg.
      const removeFid = options['remove'] as string | undefined;
      if (removeFid) {
        const r = removeFeature(harnessDir, removeFid);
        emitWork(r, json);
        return;
      }
      if (options['deactivate']) {
        const r = deactivate(harnessDir);
        emitWork(r, json);
        return;
      }
      if (options['current']) {
        const r = current(harnessDir);
        if (r === null) {
          if (json) {
            printJson({active: null});
          } else {
            printHuman('no active feature\n');
          }
          return;
        }
        emitWork(r, json);
        return;
      }

      // No feature arg → dashboard.
      if (!feature) {
        const state = State.load(harnessDir);
        const specPath = join(harnessDir, 'spec.yaml');
        let spec: unknown = null;
        try {
          if (existsSync(specPath)) {
            spec = yamlParse(readFileSync(specPath, 'utf-8'));
          }
        } catch {
          spec = null;
        }
        const suggestions = suggest(state.data, spec);
        const out = renderDashboard(state.data, spec, suggestions, {
          lang: resolveLang(spec),
          harnessDir,
        });
        if (json) {
          printJson({
            state: state.data,
            spec,
            suggestions,
            counts: state.featureCounts(),
            active_feature_id: state.data.session.active_feature_id,
          });
        } else {
          printHuman(out);
        }
        return;
      }

      const fid = feature;

      // --kickoff / --design-review / --retro: force-regenerate ceremony templates.
      function loadSpecOrNull(): unknown {
        const specPath = join(harnessDir, 'spec.yaml');
        try {
          if (statSpecFile(specPath).isFile()) {
            return yamlParseSpec(readSpecFile(specPath, 'utf-8'));
          }
        } catch {
          return null;
        }
        return null;
      }
      function findFeatureInSpec(spec: unknown, id: string): Record<string, unknown> | null {
        if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
          return null;
        }
        const features = (spec as Record<string, unknown>)['features'];
        if (!Array.isArray(features)) {
          return null;
        }
        for (const f of features) {
          if (f !== null && typeof f === 'object' && !Array.isArray(f) && (f as Record<string, unknown>)['id'] === id) {
            return f as Record<string, unknown>;
          }
        }
        return null;
      }

      if (options['kickoff']) {
        const spec = loadSpecOrNull();
        const featureObj = findFeatureInSpec(spec, fid);
        if (featureObj === null) {
          printError(`error: feature ${fid} not in spec.yaml`);
          process.exit(3);
        }
        const shapes = kickoffDetectShapes(featureObj, spec);
        if (shapes.length === 0) {
          printError(`error: no shapes detected for ${fid}`);
          process.exit(3);
        }
        let styleBlock = '';
        try {
          styleBlock = kickoffRenderStyleBlock(harnessDir, featureObj);
        } catch {
          styleBlock = '';
        }
        const path = generateKickoff(harnessDir, fid, shapes, {
          hasAudio: kickoffHasAudioFlag(featureObj),
          force: true,
          mode: resolveMode(spec),
          styleBlock,
        });
        if (json) {
          printJson({path, shapes, agents: kickoffAgentsForShapes(shapes, kickoffHasAudioFlag(featureObj))});
        } else {
          printHuman(`${path}\n`);
        }
        return;
      }
      if (options['designReview']) {
        const spec = loadSpecOrNull();
        const featureObj = findFeatureInSpec(spec, fid);
        if (featureObj === null) {
          printError(`error: feature ${fid} not in spec.yaml`);
          process.exit(3);
        }
        const path = generateDesignReview(harnessDir, fid, {
          hasAudio: kickoffHasAudioFlag(featureObj),
        });
        if (json) {
          printJson({path});
        } else {
          printHuman(`${path}\n`);
        }
        return;
      }
      if (options['retro']) {
        const spec = loadSpecOrNull();
        const path = generateRetro(harnessDir, fid, {
          force: true,
          mode: resolveMode(spec),
        });
        if (json) {
          printJson({path});
        } else {
          printHuman(`${path}\n`);
        }
        return;
      }

      // --run-gate
      if (options['runGate']) {
        const gateName = options['runGate'] as string;
        const overrideCmd =
          typeof options['overrideCommand'] === 'string'
            ? (options['overrideCommand'] as string).split(/\s+/).filter((x) => x.length > 0)
            : null;
        const projectRoot =
          typeof options['projectRoot'] === 'string' ? (options['projectRoot'] as string) : undefined;
        const r = runAndRecordGate(harnessDir, fid, gateName, {
          overrideCommand: overrideCmd,
          projectRoot,
          timeoutSec: Number(options['timeout'] ?? 300),
        });
        emitWork(r, json);
        process.exit(r.gates_failed.includes(gateName) ? 7 : 0);
      }

      // --gate (legacy manual recording)
      if (options['gate']) {
        const gateArgs = options['gate'] as string[];
        if (!Array.isArray(gateArgs) || gateArgs.length !== 2) {
          printError('error: --gate takes two values: <name> <result>');
          process.exit(3);
        }
        const [name, result] = gateArgs;
        const r = recordGate(harnessDir, fid, name!, result as GateResult, {
          note: (options['note'] as string) ?? '',
        });
        emitWork(r, json);
        return;
      }

      // --evidence
      if (typeof options['evidence'] === 'string') {
        const r = addEvidence(
          harnessDir,
          fid,
          (options['kind'] as string) ?? 'generic',
          options['evidence'] as string,
        );
        emitWork(r, json);
        return;
      }

      // --block
      if (typeof options['block'] === 'string') {
        const r = block(harnessDir, fid, options['block'] as string, {
          kind: (options['kind'] as string) ?? 'blocker',
        });
        emitWork(r, json);
        return;
      }

      // --complete
      if (options['complete']) {
        const r = complete(harnessDir, fid, {
          hotfixReason:
            typeof options['hotfixReason'] === 'string' ? (options['hotfixReason'] as string) : null,
        });
        emitWork(r, json);
        return;
      }

      // --archive
      if (options['archive']) {
        const r = archive(harnessDir, fid, {
          supersededBy:
            typeof options['supersededBy'] === 'string' ? (options['supersededBy'] as string) : null,
          reason: typeof options['reason'] === 'string' ? (options['reason'] as string) : null,
        });
        emitWork(r, json);
        return;
      }

      // Default: activate.
      const r = activate(harnessDir, fid);
      emitWork(r, json);
    });
  void work;

  // -----------------------------------------------------------------
  // sync
  // -----------------------------------------------------------------
  program
    .command('sync')
    .description('orchestrate Phase-0 sync (validate → expand → hash → render → events)')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--dry-run', 'compute outputs but do not touch disk')
    .option('--force', 'ignore edit-wins and overwrite domain.md / architecture.yaml')
    .option('--soft', 'F-076 fail-open mode — never exits non-zero')
    .option('--skip-validation', 'skip JSONSchema check')
    .option('--schema <path>', 'path to spec.schema.json override')
    .option('--timestamp <iso>', 'override UTC timestamp (tests)')
    .option('--json', 'emit JSON summary')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      const json = Boolean(options['json']);
      const soft = Boolean(options['soft']);

      if (!isDirectory(harnessDir)) {
        if (soft) {
          printError(`sync (initial): skip — harness dir ${harnessDir} not found`);
          process.exit(0);
        }
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }

      if (soft) {
        const r = tryInitialSync(harnessDir);
        const label = r.ok && !r.skipped ? 'ok' : r.skipped ? 'skip' : 'fail';
        printHuman(`sync (initial): ${label} — ${r.reason}\n`);
        process.exit(0);
      }

      try {
        const summary = runSync(harnessDir, {
          force: Boolean(options['force']),
          dryRun: Boolean(options['dryRun']),
          skipValidation: Boolean(options['skipValidation']),
          schemaPath:
            typeof options['schema'] === 'string' ? (options['schema'] as string) : null,
          timestamp:
            typeof options['timestamp'] === 'string' ? (options['timestamp'] as string) : undefined,
        });
        if (json) {
          printJson(summary);
        } else {
          printHuman(`spec_hash     ${summary.spec_hash}\n`);
          printHuman(`merkle_root   ${summary.merkle_root}\n`);
          printHuman(`include_count ${summary.include_count}\n`);
          printHuman(`drift_status  ${summary.drift_status}\n`);
          if (summary.domain_skipped) {
            printHuman('SKIP domain.md (edit-wins detected)\n');
          }
          if (summary.arch_skipped) {
            printHuman('SKIP architecture.yaml (edit-wins detected)\n');
          }
          if (summary.dry_run) {
            printHuman('(dry-run — no files written)\n');
          }
        }
      } catch (err) {
        if (err instanceof SpecValidationError) {
          printError(
            `schema error at ${err.path.length > 0 ? err.path.join('.') : '(root)'}: ${err.message}`,
          );
          if (err.reason) {
            printError(`  validator: ${err.reason}`);
          }
          process.exit(5);
        }
        printError(`sync error: ${(err as Error).message}`);
        process.exit(3);
      }
    });

  // -----------------------------------------------------------------
  // check
  // -----------------------------------------------------------------
  program
    .command('check')
    .description('drift detection (read-only / CQS — never modifies any file)')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--project-root <dir>', 'project root override (default: harness-dir parent)')
    .option('--json', 'emit JSON drift report')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      const projectRoot =
        typeof options['projectRoot'] === 'string' ? (options['projectRoot'] as string) : null;
      if (!isDirectory(harnessDir)) {
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }
      const report = runCheck(harnessDir, projectRoot);
      if (options['json']) {
        printJson({
          clean: report.findings.length === 0,
          checked: report.checked,
          findings: report.findings,
        });
      } else {
        printHuman(formatCheckHuman(report));
      }
      process.exit(report.findings.length === 0 ? 0 : 6);
    });

  // -----------------------------------------------------------------
  // status
  // -----------------------------------------------------------------
  program
    .command('status')
    .description('read-only state summary')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--feature <fid>', 'restrict summary to a single feature id')
    .option('--json', 'emit JSON report')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      if (!isDirectory(harnessDir)) {
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }
      const report = buildReport(harnessDir, {
        featureFilter:
          typeof options['feature'] === 'string' ? (options['feature'] as string) : null,
      });
      if (options['json']) {
        printJson({
          session: report.session,
          counts: report.counts,
          drift_status: report.drift_status,
          last_sync: report.last_sync,
          features: report.features_summary,
          active_feature: report.active_feature,
        });
      } else {
        printHuman(formatStatusHuman(report));
      }
    });

  // -----------------------------------------------------------------
  // events
  // -----------------------------------------------------------------
  program
    .command('events')
    .description('list events.log entries (read-only)')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--kind <type>', 'filter by event.type')
    .option('--feature <fid>', 'filter by feature id')
    .option('--since <iso>', 'drop events older than this ISO 8601 timestamp')
    .option('--all', 'show every entry (default caps at 50 most recent)')
    .option('--limit <n>', 'override the default 50 cap', '50')
    .option('--json', 'emit JSON array')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      if (!isDirectory(harnessDir)) {
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }
      const all = [...readEvents(harnessDir)];
      let filtered = filterEvents(all, {
        kind: (options['kind'] as string | undefined) ?? null,
        feature: (options['feature'] as string | undefined) ?? null,
        since: (options['since'] as string | undefined) ?? null,
      });
      if (!options['all']) {
        const limit = Number(options['limit'] ?? 50);
        filtered = filtered.slice(-limit);
      }
      if (options['json']) {
        printJson(filtered);
      } else {
        printHuman(formatEventsHuman(filtered));
      }
    });

  // -----------------------------------------------------------------
  // metrics
  // -----------------------------------------------------------------
  program
    .command('metrics')
    .description('aggregate events.log into throughput / lead time / gate stats')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--period <p>', 'window like 7d, 24h, 30m')
    .option('--since <iso>', 'override window with explicit ISO 8601 start')
    .option('--json', 'emit JSON report')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      if (!isDirectory(harnessDir)) {
        printError(`error: ${harnessDir} not found`);
        process.exit(2);
      }
      const report = computeMetrics(harnessDir, {
        period: (options['period'] as string | undefined) ?? null,
        since: (options['since'] as string | undefined) ?? null,
      });
      if (options['json']) {
        printJson(report);
      } else {
        printHuman(formatMetricsHuman(report));
      }
    });

  // -----------------------------------------------------------------
  // inbox — Q&A file-drop scanner
  // -----------------------------------------------------------------
  program
    .command('inbox')
    .description('list open Q&A questions under .harness/_workspace/questions/')
    .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
    .option('--feature <fid>', 'filter to one feature id')
    .option('--all', 'include answered questions')
    .option('--json', 'emit JSON array')
    .action((options: Record<string, unknown>) => {
      const harnessDir = resolveHarnessDir(options['harnessDir'] as string | undefined);
      const featureId = (options['feature'] as string | undefined) ?? null;
      const items = options['all']
        ? scanInbox(harnessDir, featureId)
        : openQuestions(harnessDir, featureId);
      if (options['json']) {
        printJson(items);
      } else if (items.length === 0) {
        printHuman(options['all'] ? '(no questions)\n' : '(no open questions)\n');
      } else {
        for (const q of items) {
          const flag = q.blocking ? '🔒' : '  ';
          const status = q.has_answer ? '✅' : '❓';
          printHuman(`${status} ${flag} ${q.feature_id} · ${q.from_agent} → ${q.to_agent}  ${q.path}\n`);
        }
      }
    });

  // -----------------------------------------------------------------
  // validate
  // -----------------------------------------------------------------
  program
    .command('validate')
    .description('validate a spec.yaml against the JSONSchema')
    .argument('<spec-path>', 'path to spec.yaml')
    .option('--schema <path>', 'override schema location')
    .option('--json', 'emit JSON result')
    .action((specPath: string, options: Record<string, unknown>) => {
      try {
        const data = loadSpec(specPath);
        validateSpec(
          data,
          typeof options['schema'] === 'string' ? (options['schema'] as string) : null,
        );
        if (options['json']) {
          printJson({ok: true});
        } else {
          printHuman(`valid — ${specPath}\n`);
        }
      } catch (err) {
        if (err instanceof SpecValidationError) {
          if (options['json']) {
            printJson({ok: false, path: err.path, message: err.message, reason: err.reason});
          } else {
            printError(`invalid: ${err.message}`);
            if (err.reason) {
              printError(`  reason: ${err.reason}`);
            }
          }
          process.exit(5);
        }
        printError(`error: ${(err as Error).message}`);
        process.exit(2);
      }
    });

  return program;
}

/** Entry point — parses argv and dispatches. */
export function main(argv: ReadonlyArray<string> = process.argv): void {
  const program = buildProgram();
  program.parse([...argv]);
}
