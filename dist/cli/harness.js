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
import { existsSync, statSync } from 'node:fs';
import { basename, join, resolve as resolvePath } from 'node:path';
import { Command } from 'commander';
import { generateDesignReview } from '../ceremonies/designReview.js';
import { runSkeletonInit } from '../init/skeleton.js';
import { generateIdeaSpec, } from '../init/scenarioIdea.js';
import { collectSignals } from '../init/codebase/signals.js';
import { writeConventions } from '../init/codebase/conventionsWriter.js';
import { resolveConventionConflict, } from '../init/codebase/conflictResolver.js';
import { detectPlanDocCandidate } from '../init/codebase/mdDetect.js';
import { autoDetectScenario } from '../init/autoDetect.js';
import { seedSpecFromPlanDoc } from '../init/scenarioPlanDoc.js';
import { fillConventionsSection, SectionAlreadyFilledError, } from '../init/codebase/conventionsFill.js';
import { recordLlmCall } from '../init/tokenLog.js';
import { agentsForShapes as kickoffAgentsForShapes, detectShapes as kickoffDetectShapes, generateKickoff, hasAudioFlag as kickoffHasAudioFlag, renderStyleBlock as kickoffRenderStyleBlock, } from '../ceremonies/kickoff.js';
import { generateRetro } from '../ceremonies/retro.js';
import { openQuestions, scanInbox } from '../ceremonies/inbox.js';
import { parse as yamlParseSpec } from 'yaml';
import { readFileSync as readSpecFile, statSync as statSpecFile } from 'node:fs';
import { resolveMode } from '../core/projectMode.js';
import { formatHuman as formatCheckHuman, runCheck } from '../check.js';
import { filterEvents, formatHuman as formatEventsHuman } from '../events.js';
import { readEvents } from '../core/eventLog.js';
import { compute as computeMetrics, formatHuman as formatMetricsHuman } from '../metrics.js';
import { render as renderDashboard } from '../ui/dashboard.js';
import { suggest } from '../ui/intentPlanner.js';
import { resolveLang } from '../ui/lang.js';
import { SpecValidationError, collectWarnings as collectSpecWarnings, loadSpec, validate as validateSpec, } from '../spec/validate.js';
import { exportSpec } from '../spec/exportSpec.js';
import { State } from '../core/state.js';
import { buildReport, formatHuman as formatStatusHuman } from '../status.js';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { run as runSync, tryInitialSync } from '../sync.js';
import { activate, addEvidence, archive, block, complete, current, deactivate, recordGate, removeFeature, runAndRecordGate, } from '../work.js';
function printHuman(text) {
    process.stdout.write(text);
}
function printJson(obj) {
    process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}
function printError(message) {
    process.stderr.write(`${message}\n`);
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function resolveHarnessDir(opt) {
    return resolvePath(opt ?? join(process.cwd(), '.harness'));
}
function workResultToJson(r) {
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
function formatWorkHuman(r) {
    const lines = [];
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
function emitWork(result, json) {
    if (json) {
        printJson(workResultToJson(result));
    }
    else {
        printHuman(formatWorkHuman(result));
    }
}
function buildProgram() {
    const program = new Command();
    program
        .name('harness')
        .description('Multi-agent development harness — TS CLI for Claude Code plugin')
        .version('0.14.1');
    // -----------------------------------------------------------------
    // work
    // -----------------------------------------------------------------
    const work = program
        .command('work')
        .description('feature lifecycle (activate / gate / evidence / complete / dashboard)')
        .argument('[feature]', 'feature id (e.g. F-001) — omitted invokes the dashboard')
        .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
        .option('--current', 'show the active feature (read-only)')
        .option('--gate <values...>', 'record a gate result manually — `--gate <name> <result>` (e.g. `--gate gate_0 pass`)')
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
        .action((feature, options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        const json = Boolean(options['json']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        // --remove handles its own feature id arg.
        const removeFid = options['remove'];
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
                    printJson({ active: null });
                }
                else {
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
            let spec = null;
            try {
                if (existsSync(specPath)) {
                    spec = yamlParse(readFileSync(specPath, 'utf-8'));
                }
            }
            catch {
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
            }
            else {
                printHuman(out);
            }
            return;
        }
        const fid = feature;
        // --kickoff / --design-review / --retro: force-regenerate ceremony templates.
        function loadSpecOrNull() {
            const specPath = join(harnessDir, 'spec.yaml');
            try {
                if (statSpecFile(specPath).isFile()) {
                    return yamlParseSpec(readSpecFile(specPath, 'utf-8'));
                }
            }
            catch {
                return null;
            }
            return null;
        }
        function findFeatureInSpec(spec, id) {
            if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
                return null;
            }
            const features = spec['features'];
            if (!Array.isArray(features)) {
                return null;
            }
            for (const f of features) {
                if (f !== null && typeof f === 'object' && !Array.isArray(f) && f['id'] === id) {
                    return f;
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
            }
            catch {
                styleBlock = '';
            }
            const path = generateKickoff(harnessDir, fid, shapes, {
                hasAudio: kickoffHasAudioFlag(featureObj),
                force: true,
                mode: resolveMode(spec),
                styleBlock,
            });
            if (json) {
                printJson({ path, shapes, agents: kickoffAgentsForShapes(shapes, kickoffHasAudioFlag(featureObj)) });
            }
            else {
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
                printJson({ path });
            }
            else {
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
                printJson({ path });
            }
            else {
                printHuman(`${path}\n`);
            }
            return;
        }
        // --run-gate
        if (options['runGate']) {
            const gateName = options['runGate'];
            const overrideCmd = typeof options['overrideCommand'] === 'string'
                ? options['overrideCommand'].split(/\s+/).filter((x) => x.length > 0)
                : null;
            const projectRoot = typeof options['projectRoot'] === 'string' ? options['projectRoot'] : undefined;
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
            const gateArgs = options['gate'];
            if (!Array.isArray(gateArgs) || gateArgs.length !== 2) {
                printError('error: --gate takes two values: <name> <result>');
                process.exit(3);
            }
            const [name, result] = gateArgs;
            const r = recordGate(harnessDir, fid, name, result, {
                note: options['note'] ?? '',
            });
            emitWork(r, json);
            return;
        }
        // --evidence
        if (typeof options['evidence'] === 'string') {
            const r = addEvidence(harnessDir, fid, options['kind'] ?? 'generic', options['evidence']);
            emitWork(r, json);
            return;
        }
        // --block
        if (typeof options['block'] === 'string') {
            const r = block(harnessDir, fid, options['block'], {
                kind: options['kind'] ?? 'blocker',
            });
            emitWork(r, json);
            return;
        }
        // --complete
        if (options['complete']) {
            const r = complete(harnessDir, fid, {
                hotfixReason: typeof options['hotfixReason'] === 'string' ? options['hotfixReason'] : null,
            });
            emitWork(r, json);
            return;
        }
        // --archive
        if (options['archive']) {
            const r = archive(harnessDir, fid, {
                supersededBy: typeof options['supersededBy'] === 'string' ? options['supersededBy'] : null,
                reason: typeof options['reason'] === 'string' ? options['reason'] : null,
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
        .option('--no-archive-migrate', 'skip F-137 bulk archive migration this run')
        .option('--no-open-questions-archive', 'skip F-147 auto-archive of resolved open_questions this run')
        .option('--json', 'emit JSON summary')
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
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
                schemaPath: typeof options['schema'] === 'string' ? options['schema'] : null,
                timestamp: typeof options['timestamp'] === 'string' ? options['timestamp'] : undefined,
                noArchiveMigrate: options['archiveMigrate'] === false,
                noOpenQuestionsArchive: options['openQuestionsArchive'] === false,
            });
            if (json) {
                printJson(summary);
            }
            else {
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
        }
        catch (err) {
            if (err instanceof SpecValidationError) {
                printError(`schema error at ${err.path.length > 0 ? err.path.join('.') : '(root)'}: ${err.message}`);
                if (err.reason) {
                    printError(`  validator: ${err.reason}`);
                }
                process.exit(5);
            }
            printError(`sync error: ${err.message}`);
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
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        const projectRoot = typeof options['projectRoot'] === 'string' ? options['projectRoot'] : null;
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
        }
        else {
            printHuman(formatCheckHuman(report));
        }
        process.exit(report.findings.length === 0 ? 0 : 6);
    });
    // -----------------------------------------------------------------
    // export-spec (F-131)
    // -----------------------------------------------------------------
    program
        .command('export-spec')
        .description('emit spec.yaml to stdout (read-only / CQS); --active-only ' +
        'compacts done/archived features so the LLM import stays small')
        .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
        .option('--active-only', 'compact done/archived feature bodies')
        .option('--output <path>', 'write to file instead of stdout')
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        let yaml;
        try {
            yaml = exportSpec(harnessDir, { activeOnly: Boolean(options['activeOnly']) });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            printError(`error: ${msg}`);
            process.exit(2);
        }
        const outputPath = typeof options['output'] === 'string' ? options['output'] : null;
        if (outputPath !== null) {
            writeFileSync(outputPath, yaml, 'utf-8');
        }
        else {
            process.stdout.write(yaml);
        }
        process.exit(0);
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
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        const report = buildReport(harnessDir, {
            featureFilter: typeof options['feature'] === 'string' ? options['feature'] : null,
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
        }
        else {
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
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        const all = [...readEvents(harnessDir)];
        let filtered = filterEvents(all, {
            kind: options['kind'] ?? null,
            feature: options['feature'] ?? null,
            since: options['since'] ?? null,
        });
        if (!options['all']) {
            const limit = Number(options['limit'] ?? 50);
            filtered = filtered.slice(-limit);
        }
        if (options['json']) {
            printJson(filtered);
        }
        else {
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
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        const report = computeMetrics(harnessDir, {
            period: options['period'] ?? null,
            since: options['since'] ?? null,
        });
        if (options['json']) {
            printJson(report);
        }
        else {
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
        .action((options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        const featureId = options['feature'] ?? null;
        const items = options['all']
            ? scanInbox(harnessDir, featureId)
            : openQuestions(harnessDir, featureId);
        if (options['json']) {
            printJson(items);
        }
        else if (items.length === 0) {
            printHuman(options['all'] ? '(no questions)\n' : '(no open questions)\n');
        }
        else {
            for (const q of items) {
                const flag = q.blocking ? '🔒' : '  ';
                const status = q.has_answer ? '✅' : '❓';
                printHuman(`${status} ${flag} ${q.feature_id} · ${q.from_agent} → ${q.to_agent}  ${q.path}\n`);
            }
        }
    });
    // -----------------------------------------------------------------
    // drive — autonomous loop (v0.14.0 — Stage 1 (F-118) Goal primitives;
    // Stage 2 (F-119) Phase A/B/C autonomous flow)
    // -----------------------------------------------------------------
    program
        .command('drive')
        .description('autonomous loop driver — natural-language goal → Phase A plan → Phase B execute → Phase C retro')
        .argument('[target]', 'goal id (G-NNN), feature id (F-NNN), or free-text natural-language goal')
        .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
        .option('--status', 'render the progress dashboard for one (or all) goal(s) — read-only')
        .option('--all', 'with --status: render every goal in the spec')
        .option('--json', 'emit JSON output (status / dry-run / resume — machine consumable)')
        .option('--watch', 'with --status: re-render every <interval> seconds')
        .option('--interval <sec>', 'with --status --watch: refresh interval (default 2s)', '2')
        .option('--resume', 'continue Phase A or Phase B from the persisted checkpoint')
        .option('--plan-only', 'run Phase A advances; halt before Phase B execute loop')
        .option('--auto-approve-brief', 'skip the brief.md approval halt (#1 part 1)')
        .option('--auto-approve-all', 'skip every plan-phase halt (brief + plan)')
        .option('--max-iterations <n>', 'override Phase B iteration cap (default 50)')
        .option('--max-hours <n>', 'override Phase B wall-clock cap (default 2h)')
        .option('--max-retries <n>', 'override consecutive-fail cap before halt #3 (default 3)')
        .option('--hard-step-limit <n>', 'hard ceiling on steps per drive invocation (default 100)')
        .option('--dry-run', 'print the next action without executing it')
        .option('--abort [gid]', 'clear the active drive checkpoint (active goal by default)')
        .action((target, options) => {
        const harnessDir = resolveHarnessDir(options['harnessDir']);
        if (!isDirectory(harnessDir)) {
            printError(`error: ${harnessDir} not found`);
            process.exit(2);
        }
        const isStatus = Boolean(options['status']) ||
            Boolean(options['watch']) ||
            Boolean(options['all']) ||
            // status is also the default when no argument and no Phase-A/B flag is supplied
            (target === undefined &&
                !options['resume'] &&
                !options['planOnly'] &&
                !options['dryRun'] &&
                !options['abort']);
        const explicitGoal = typeof target === 'string' && /^G-\d+$/i.test(target) ? target : null;
        const explicitFeature = typeof target === 'string' && /^F-\d+$/i.test(target) ? target : null;
        void explicitFeature; // currently surfaced via dashboard / status; loop selects via checkpoint
        const json = Boolean(options['json']);
        const approvals = {
            autoApproveBrief: Boolean(options['autoApproveBrief']),
            autoApproveAll: Boolean(options['autoApproveAll']),
        };
        // ---- --status / --watch / --all + bare drive ----
        if (isStatus) {
            void import('../drive/statusCommand.js')
                .then(({ runDriveStatus }) => runDriveStatus({
                harnessDir,
                goalId: explicitGoal,
                all: Boolean(options['all']),
                json,
                watch: Boolean(options['watch']),
                intervalSec: Number(options['interval'] ?? 2),
            }))
                .then((code) => {
                if (typeof code === 'number' && code !== 0) {
                    process.exit(code);
                }
            })
                .catch((err) => {
                printError(`drive: ${err.message}`);
                process.exit(2);
            });
            return;
        }
        // ---- --abort ----
        if (options['abort'] !== undefined) {
            void import('../drive/checkpoint.js')
                .then(({ clearCheckpoint, loadCheckpoint }) => {
                const ck = loadCheckpoint(harnessDir);
                const cleared = clearCheckpoint(harnessDir);
                if (cleared) {
                    const goalId = ck?.goal_id ?? '(unknown)';
                    if (json) {
                        printJson({ aborted: true, goal_id: goalId });
                    }
                    else {
                        printHuman(`drive: aborted ${goalId}; checkpoint cleared.\n`);
                    }
                }
                else {
                    if (json) {
                        printJson({ aborted: false, message: 'no active checkpoint' });
                    }
                    else {
                        printHuman('drive: no active drive checkpoint to abort.\n');
                    }
                }
            })
                .catch((err) => {
                printError(`drive: ${err.message}`);
                process.exit(2);
            });
            return;
        }
        // ---- new free-text goal ----
        const isFreeText = typeof target === 'string' && !explicitGoal && !explicitFeature;
        if (isFreeText) {
            void import('../drive/planPhase.js')
                .then(({ startPhaseA }) => {
                const r = startPhaseA({ harnessDir, title: target, approvals });
                if (json) {
                    printJson({
                        goal_id: r.goalId,
                        brief_path: r.briefPath,
                        halt: { reason: r.halt.reason, message: r.halt.message },
                    });
                }
                else {
                    printHuman(`drive: goal ${r.goalId} created. researcher should write ${r.briefPath}.\n` +
                        `${r.halt.message}\n`);
                }
            })
                .catch((err) => {
                printError(`drive: ${err.message}`);
                process.exit(2);
            });
            return;
        }
        // ---- --resume / --plan-only / --dry-run ----
        // All three load the checkpoint and decide the next action via planPhase / loop.
        const planOnly = Boolean(options['planOnly']);
        const dryRun = Boolean(options['dryRun']);
        void import('../drive/checkpoint.js')
            .then(async ({ loadCheckpoint, saveCheckpoint }) => {
            const ck = loadCheckpoint(harnessDir);
            if (ck === null) {
                printError('drive: no active checkpoint. Start with `harness drive "<natural-language goal>"`.');
                process.exit(3);
                return;
            }
            // Override caps when the user supplied flags.
            if (options['maxIterations'] !== undefined) {
                ck.execute.max_iterations = Number(options['maxIterations']);
            }
            if (options['maxHours'] !== undefined) {
                ck.execute.max_seconds = Math.round(Number(options['maxHours']) * 3600);
            }
            saveCheckpoint(harnessDir, ck);
            // Phase A advance.
            if (ck.phase === 'planning') {
                const { advancePhaseA } = await import('../drive/planPhase.js');
                const r = advancePhaseA(harnessDir, approvals);
                if (r.kind === 'halt') {
                    if (json) {
                        printJson({
                            phase: 'planning',
                            halt: { reason: r.halt.reason, message: r.halt.message },
                            brief_path: r.briefPath,
                            plan_path: r.planPath,
                        });
                    }
                    else {
                        printHuman(`drive: ${r.halt.message}\n`);
                    }
                    return;
                }
                // phase_b_ready
                if (planOnly) {
                    if (json) {
                        printJson({ phase: 'scaffolded', goal_id: r.goalId, feature_ids: r.featureIds });
                    }
                    else {
                        printHuman(`drive: Phase A done. Goal ${r.goalId} scaffolded with ${r.featureIds.length} features. ` +
                            `(--plan-only requested — stopping before Phase B execute loop.)\n`);
                    }
                    return;
                }
                // Fall through into Phase B.
            }
            // Phase B step / loop.
            const { runDriveLoop, runDriveStep } = await import('../drive/loop.js');
            if (dryRun) {
                const step = runDriveStep(harnessDir, {
                    harnessDir,
                    maxRetries: options['maxRetries'] !== undefined ? Number(options['maxRetries']) : undefined,
                });
                const summary = {
                    dry_run: true,
                    proceed: step.proceed,
                    feature_id: step.feature_id ?? null,
                };
                if (step.action !== undefined && step.action !== null) {
                    summary.action = step.action.kind;
                    if ('feature_id' in step.action) {
                        summary.action_feature = step.action.feature_id;
                    }
                    if ('gate' in step.action) {
                        summary.action_gate = step.action.gate;
                    }
                }
                if (step.halt !== undefined) {
                    summary.halt = { reason: step.halt.reason, message: step.halt.message };
                }
                if (json) {
                    printJson(summary);
                }
                else {
                    if (step.halt !== undefined) {
                        printHuman(`drive [dry-run]: would halt — ${step.halt.message}\n`);
                    }
                    else if (step.action !== null && step.action !== undefined) {
                        printHuman(`drive [dry-run]: next action = ${step.action.kind}\n`);
                    }
                    else {
                        printHuman('drive [dry-run]: no action selected\n');
                    }
                }
                return;
            }
            const r = runDriveLoop({
                harnessDir,
                maxRetries: options['maxRetries'] !== undefined ? Number(options['maxRetries']) : undefined,
                hardIterationLimit: options['hardStepLimit'] !== undefined ? Number(options['hardStepLimit']) : 100,
            });
            const summary = {
                proceed: r.proceed,
                goal_done: r.goal_done ?? false,
                feature_id: r.feature_id ?? null,
            };
            if (r.halt !== undefined) {
                summary.halt = { reason: r.halt.reason, message: r.halt.message };
            }
            if (json) {
                printJson(summary);
            }
            else if (r.goal_done) {
                printHuman('drive: goal complete — Phase C retro generated.\n');
            }
            else if (r.halt !== undefined) {
                printHuman(`drive: ${r.halt.message}\n`);
            }
            else {
                printHuman('drive: step limit reached for this invocation; resume to continue.\n');
            }
        })
            .catch((err) => {
            printError(`drive: ${err.message}`);
            process.exit(2);
        });
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
        .action((specPath, options) => {
        try {
            const data = loadSpec(specPath);
            validateSpec(data, typeof options['schema'] === 'string' ? options['schema'] : null);
            const warnings = collectSpecWarnings(data);
            if (options['json']) {
                printJson({ ok: true, warnings });
            }
            else {
                printHuman(`valid — ${specPath}\n`);
                for (const w of warnings) {
                    const pathStr = w.path.map((p) => String(p)).join('.');
                    process.stderr.write(`[warn] ${w.code} (${pathStr}): ${w.message}\n`);
                }
            }
        }
        catch (err) {
            if (err instanceof SpecValidationError) {
                if (options['json']) {
                    printJson({ ok: false, path: err.path, message: err.message, reason: err.reason });
                }
                else {
                    printError(`invalid: ${err.message}`);
                    if (err.reason) {
                        printError(`  reason: ${err.reason}`);
                    }
                }
                process.exit(5);
            }
            printError(`error: ${err.message}`);
            process.exit(2);
        }
    });
    // -----------------------------------------------------------------
    // init  (F-158 — bench-friendly backend of /harness-boot:init)
    // -----------------------------------------------------------------
    program
        .command('init')
        .description('install the harness skeleton (use --skeleton-only for the regression-safe path; ' +
        'the full scenario UX lives in the /harness-boot:init slash command)')
        .option('--harness-dir <dir>', 'target project root (`.harness/` is created inside)', '.')
        .option('--skeleton-only', 'copy bare starter templates only — zero LLM calls, < 500 ms wall time')
        .option('--scenario <kind>', 'scenario branch — `idea` (F-159) writes a draft spec from the four ' +
        'ticky-taka answers; plan_doc / existing_code land later')
        .option('--plugin-root <dir>', 'plugin root path (auto-resolves from `harness` binary location)')
        .option('--mode <mode>', 'solo (default) or team — controls .gitignore behavior', 'solo')
        // Scenario-idea answers (F-159) — consumed when `--scenario idea` is set.
        .option('--name <project-name>', '[scenario idea] project name (kebab-case recommended)')
        .option('--vision <text>', '[scenario idea] one-line vision / what the product does')
        .option('--features <names>', '[scenario idea] comma-separated feature names (3–5)')
        .option('--project-mode <mode>', '[scenario idea] prototype (default) or product', 'prototype')
        .option('--quality-focus <list>', '[scenario idea] comma-separated values from {design,performance,accessibility,security}', '')
        .option('--deliverable-type <type>', '[scenario idea] cli (default), web-service, game, worker, library, static-site, desktop, mobile-app', 'cli')
        .option('--conventions-conflict <policy>', '[scenario existing_code] merge | coexist (default) | skip — what to do when CLAUDE.md / .cursorrules / AGENTS.md already exists', 'coexist')
        .option('--plan <path>', '[scenario plan_doc] explicit path to the plan markdown (auto-detects when omitted and exactly one non-README md exists)')
        .option('--json', 'emit JSON result')
        .action((options) => {
        let wantsSkeleton = Boolean(options['skeletonOnly']);
        let scenario = typeof options['scenario'] === 'string' ? options['scenario'] : null;
        if (wantsSkeleton && scenario) {
            printError('init: --skeleton-only and --scenario are mutually exclusive');
            process.exit(3);
        }
        const targetDir = resolvePath(typeof options['harnessDir'] === 'string' ? options['harnessDir'] : '.');
        // F-171 — no flag means "do the obvious thing": probe the
        // directory and route to plan_doc / existing_code / skeleton-only
        // automatically. The detection functions
        // (detectPlanDocCandidate, collectSignals) already existed; this
        // is just where they finally get wired into the CLI.
        if (!wantsSkeleton && !scenario) {
            const detected = autoDetectScenario(targetDir);
            if (detected.scenario === 'skeleton-only') {
                wantsSkeleton = true;
            }
            else {
                scenario = detected.scenario;
            }
            printHuman(`init: auto-detected ${detected.reason}\n`);
        }
        const pluginRoot = typeof options['pluginRoot'] === 'string'
            ? resolvePath(options['pluginRoot'])
            : resolvePluginRootFromBinary();
        const mode = options['mode'] === 'team' || options['mode'] === 'solo'
            ? options['mode']
            : 'solo';
        try {
            if (wantsSkeleton) {
                const result = runSkeletonInit({ targetDir, pluginRoot, mode });
                if (options['json']) {
                    printJson({
                        ok: true,
                        scenario: 'skeleton-only',
                        harness_dir: result.harnessDir,
                        files_written: result.filesWritten,
                        wall_time_ms: result.wallTimeMs,
                        llm_call_count: result.llmCallCount,
                        claude_md_written: result.claudeMdWritten,
                    });
                }
                else {
                    printHuman(`init (skeleton-only): ${result.filesWritten.length} files written ` +
                        `to ${result.harnessDir} in ${result.wallTimeMs.toFixed(1)} ms ` +
                        `(0 LLM calls)\n`);
                    if (!result.claudeMdWritten) {
                        process.stderr.write('init: CLAUDE.md already exists — preserved\n');
                    }
                }
                return;
            }
            if (scenario === 'idea') {
                runIdeaScenario({ targetDir, pluginRoot, mode, options });
                return;
            }
            if (scenario === 'existing_code') {
                runExistingCodeScenario({ targetDir, pluginRoot, mode, options });
                return;
            }
            if (scenario === 'plan_doc') {
                runPlanDocScenario({ targetDir, pluginRoot, mode, options });
                return;
            }
            printError(`init: scenario '${scenario}' is not implemented yet. ` +
                'Supported in v0.15.6: idea, existing_code, plan_doc.');
            process.exit(3);
        }
        catch (err) {
            const message = err.message;
            if (options['json']) {
                printJson({ ok: false, error: message });
            }
            else {
                printError(`error: ${message}`);
            }
            process.exit(2);
        }
    });
    // -----------------------------------------------------------------
    // conventions  (F-163 — LLM hook fill for scenario-3b)
    // -----------------------------------------------------------------
    const conventions = program
        .command('conventions')
        .description('manage .harness/conventions.md (currently only `fill` subcommand)');
    conventions
        .command('fill')
        .description('replace a [pending: LLM hook stub] placeholder in conventions.md with text the ' +
        'slash command produced from sampling source files')
        .requiredOption('--section <name>', 'comments | tests')
        .requiredOption('--text <body>', 'the markdown body to inject')
        .option('--harness-dir <dir>', 'path to .harness directory', './.harness')
        .option('--tokens-in <n>', 'LLM input tokens (for the bench)', '0')
        .option('--tokens-out <n>', 'LLM output tokens (for the bench)', '0')
        .option('--model <id>', 'model identifier (recorded in the llm_call event)')
        .option('--json', 'emit JSON result')
        .action((options) => {
        const sectionRaw = options['section'];
        if (sectionRaw !== 'comments' && sectionRaw !== 'tests') {
            printError(`conventions fill: --section must be 'comments' or 'tests' (got '${String(sectionRaw)}')`);
            process.exit(3);
        }
        const section = sectionRaw;
        const text = typeof options['text'] === 'string' ? options['text'] : '';
        if (text.trim().length === 0) {
            printError('conventions fill: --text must be non-empty');
            process.exit(3);
        }
        const harnessDir = resolvePath(typeof options['harnessDir'] === 'string' ? options['harnessDir'] : './.harness');
        const conventionsPath = join(harnessDir, 'conventions.md');
        const tokensIn = Number(options['tokensIn'] ?? 0);
        const tokensOut = Number(options['tokensOut'] ?? 0);
        const model = typeof options['model'] === 'string' ? options['model'] : undefined;
        try {
            const result = fillConventionsSection(conventionsPath, section, text);
            const eventsPath = join(harnessDir, 'events.log');
            recordLlmCall({
                eventsPath,
                event: {
                    scenario: 'existing_code',
                    agent: 'codebase-archaeologist',
                    tokens_in: Number.isFinite(tokensIn) ? tokensIn : 0,
                    tokens_out: Number.isFinite(tokensOut) ? tokensOut : 0,
                    ...(model !== undefined ? { model } : {}),
                },
            });
            if (options['json']) {
                printJson({
                    ok: true,
                    path: result.path,
                    section: result.section,
                    tokens_in: tokensIn,
                    tokens_out: tokensOut,
                });
            }
            else {
                printHuman(`conventions fill: ${result.section} section replaced in ${result.path} ` +
                    `(llm_call recorded: in=${tokensIn} out=${tokensOut})\n`);
            }
        }
        catch (err) {
            if (err instanceof SectionAlreadyFilledError) {
                if (options['json']) {
                    printJson({ ok: false, error: err.message });
                }
                else {
                    printError(`error: ${err.message}`);
                }
                process.exit(4);
            }
            printError(`error: ${err.message}`);
            process.exit(2);
        }
    });
    return program;
}
/**
 * Scenario-1 (idea → spec) CLI handler — F-159.
 *
 * Bootstraps the skeleton, then overwrites the just-copied
 * `spec.yaml` with the draft generated from the ticky-taka
 * answers. Skeleton boot remains the byte-stable baseline; this
 * path adds two more file writes (spec rewrite + draft label).
 */
function runIdeaScenario(args) {
    const { targetDir, pluginRoot, mode, options } = args;
    // F-171 — smart defaults for missing args. The slash command still
    // collects rich answers from the researcher ticky-taka; CLI-direct
    // callers who skip them get a fillable draft instead of an error.
    const rawName = optionAsString(options, 'name');
    const rawVision = optionAsString(options, 'vision');
    const rawFeatures = optionAsString(options, 'features');
    const dirBasename = basename(resolvePath(targetDir));
    const name = rawName ?? dirBasename;
    const vision = rawVision ?? '<TBD — fill in spec.yaml>';
    const featuresRaw = rawFeatures ?? 'walking-skeleton';
    const defaultsApplied = rawName === null || rawVision === null || rawFeatures === null;
    const projectMode = optionAsString(options, 'projectMode') ?? 'prototype';
    const qualityFocusRaw = optionAsString(options, 'qualityFocus') ?? '';
    const deliverableType = optionAsString(options, 'deliverableType') ?? 'cli';
    if (projectMode !== 'prototype' && projectMode !== 'product') {
        printError(`init: --project-mode must be 'prototype' or 'product' (got '${projectMode}')`);
        process.exit(3);
    }
    const features = featuresRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (features.length === 0) {
        printError('init --scenario idea: --features must list at least one feature name');
        process.exit(3);
    }
    const qualityFocus = qualityFocusRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s === 'design' || s === 'performance' || s === 'accessibility' || s === 'security');
    // Boot the skeleton so harness.yaml / state.yaml / events.log exist.
    const skel = runSkeletonInit({ targetDir, pluginRoot, mode });
    // Overwrite spec.yaml with the authored draft.
    const generated = generateIdeaSpec({
        name,
        vision,
        features,
        mode: projectMode,
        qualityFocus,
        deliverableType: deliverableType,
    });
    const specPath = join(skel.harnessDir, 'spec.yaml');
    writeFileSync(specPath, generated.specYaml, 'utf8');
    if (options['json']) {
        printJson({
            ok: true,
            scenario: 'idea',
            harness_dir: skel.harnessDir,
            spec_path: specPath,
            content_hash: generated.contentHash,
            confidence: generated.confidence,
            defaults_applied: defaultsApplied,
            claude_md_written: skel.claudeMdWritten,
            llm_call_count: 0,
        });
    }
    else {
        printHuman(`init (scenario: idea): wrote ${specPath} · confidence ${generated.confidence} · ` +
            `draft=true · ${features.length} features · hash ${generated.contentHash.slice(0, 19)}…\n` +
            `next: /harness-boot:work F-1 to start the first cycle\n`);
        if (!skel.claudeMdWritten) {
            process.stderr.write('init: CLAUDE.md already exists — preserved\n');
        }
        if (defaultsApplied) {
            process.stderr.write('init: smart defaults applied for missing --name/--vision/--features — ' +
                'edit .harness/spec.yaml to fill in real values\n');
        }
    }
}
function optionAsString(options, key) {
    const value = options[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
/**
 * Scenario-3a (existing_code → conventions + spec scaffold) CLI
 * handler. Deterministic Layer-0: no LLM call from the binary.
 * The slash command fills the Comments and Tests placeholders in
 * PR 3b.
 */
function runExistingCodeScenario(args) {
    const { targetDir, pluginRoot, mode, options } = args;
    // 1. Boot the skeleton (gives us a starter spec.yaml + harness.yaml + state.yaml).
    const skel = runSkeletonInit({ targetDir, pluginRoot, mode });
    // 2. Walk the user project for Layer-0 signals.
    const signals = collectSignals(targetDir);
    // 3. Detect existing convention docs and resolve the conflict.
    const policy = parseConflictPolicy(options);
    const conventionsPath = join(skel.harnessDir, 'conventions.md');
    // Render the body once so both the standalone file and the merge
    // path see the same content.
    const conv = writeConventions(signals, conventionsPath);
    const resolution = resolveConventionConflict(targetDir, policy, conv.body);
    if (!resolution.writeStandalone) {
        // Remove the standalone file we just wrote — the merged target
        // (or the user's existing doc, for `skip`) is the source of truth.
        try {
            rmSync(conventionsPath, { force: true });
        }
        catch {
            // ignore — fail-open on cleanup
        }
    }
    // 4. Patch the spec.yaml to record project.name + constraints.tech_stack
    //    (deterministic fields only — vision / features are left for the user
    //    or the slash command's product-planner pass).
    const specPath = join(skel.harnessDir, 'spec.yaml');
    patchSpecWithSignals(specPath, signals);
    if (options['json']) {
        printJson({
            ok: true,
            scenario: 'existing_code',
            harness_dir: skel.harnessDir,
            conventions_path: resolution.writeStandalone ? conv.path : null,
            conventions_fact_count: conv.factCount,
            spec_path: specPath,
            directory_pattern: signals.directoryPattern,
            conflict_policy: policy,
            conflict_detected: resolution.detected,
            merged_into: resolution.mergedInto,
            claude_md_written: skel.claudeMdWritten,
            llm_call_count: 0,
        });
    }
    else {
        const conflictLine = resolution.detected.length > 0
            ? `  existing convention docs: ${resolution.detected.join(', ')} → policy: ${policy}` +
                (resolution.mergedInto ? ` (merged into ${resolution.mergedInto})` : '')
            : '';
        printHuman(`init (scenario: existing_code): ${conv.factCount} facts ` +
            (resolution.writeStandalone ? `written to ${conv.path}` : `merged or skipped (no standalone file)`) +
            '\n' +
            `  detected: ${signals.directoryPattern} layout · ` +
            `${signals.manifests.length} manifests · ` +
            `${signals.styleConfigs.length} style configs\n` +
            (conflictLine ? conflictLine + '\n' : '') +
            `next: edit .harness/spec.yaml (project.name + vision), then /harness-boot:work F-0\n`);
        if (!skel.claudeMdWritten) {
            process.stderr.write('init: CLAUDE.md already exists — preserved\n');
        }
    }
}
function parseConflictPolicy(options) {
    const value = optionAsString(options, 'conventionsConflict');
    if (value === 'merge' || value === 'coexist' || value === 'skip')
        return value;
    return 'coexist';
}
/**
 * Scenario-2 (plan_doc → spec) CLI handler. CLI side is
 * deterministic: read the md, redact, seed project.name +
 * summary + description + metadata.source. The slash command
 * runs spec-conversion in a follow-up turn to fill features etc.
 */
function runPlanDocScenario(args) {
    const { targetDir, pluginRoot, mode, options } = args;
    const explicit = optionAsString(options, 'plan');
    let mdRelative = explicit ?? detectPlanDocCandidate(targetDir);
    if (mdRelative === null) {
        printError('init --scenario plan_doc: could not auto-detect a single plan markdown ' +
            '(found 0 or 2+ candidates excluding README/CHANGELOG/LICENSE). ' +
            'Pass --plan <path> explicitly.');
        process.exit(3);
    }
    const mdPath = resolvePath(targetDir, mdRelative);
    if (!existsSync(mdPath) || !statSync(mdPath).isFile()) {
        printError(`init --scenario plan_doc: ${mdPath} does not exist or is not a file`);
        process.exit(3);
    }
    const skel = runSkeletonInit({ targetDir, pluginRoot, mode });
    const specPath = join(skel.harnessDir, 'spec.yaml');
    const seeded = seedSpecFromPlanDoc({ mdPath, specPath, projectRoot: targetDir });
    writeFileSync(specPath, seeded.specYaml, 'utf8');
    if (options['json']) {
        printJson({
            ok: true,
            scenario: 'plan_doc',
            harness_dir: skel.harnessDir,
            spec_path: specPath,
            plan_doc_path: seeded.planDocPath,
            project_name: seeded.projectName,
            content_hash: seeded.contentHash,
            claude_md_written: skel.claudeMdWritten,
            llm_call_count: 0,
        });
    }
    else {
        printHuman(`init (scenario: plan_doc): seeded spec from ${seeded.planDocPath}\n` +
            `  project: ${seeded.projectName}\n` +
            `  summary: ${seeded.summary.slice(0, 100)}${seeded.summary.length > 100 ? '…' : ''}\n` +
            `  next: /harness-boot:work to invoke spec-conversion for the full spec\n`);
        if (!skel.claudeMdWritten) {
            process.stderr.write('init: CLAUDE.md already exists — preserved\n');
        }
    }
}
function patchSpecWithSignals(specPath, signals) {
    const body = readFileSync(specPath, 'utf8');
    const parsed = yamlParse(body);
    if (!parsed || typeof parsed !== 'object')
        return;
    const constraints = parsed['constraints'] ?? {};
    const techStack = constraints['tech_stack'] ?? {};
    const techPairs = [
        ['runtime', signals.tech.runtime],
        ['language', signals.tech.language],
        ['test', signals.tech.test],
        ['build', signals.tech.build],
        ['min_version', signals.tech.min_version],
    ];
    for (const [key, value] of techPairs) {
        if (value !== undefined && value !== null)
            techStack[key] = value;
    }
    constraints['tech_stack'] = techStack;
    parsed['constraints'] = constraints;
    // project.name from directory basename when missing.
    const project = parsed['project'] ?? {};
    if (typeof project['name'] !== 'string' || project['name'].length === 0) {
        project['name'] = signals.projectRoot.split('/').filter((s) => s.length > 0).pop() ?? 'project';
    }
    parsed['project'] = project;
    // metadata.source.origin = existing_code.
    const metadata = parsed['metadata'] ?? {};
    const source = metadata['source'] ?? {};
    source['origin'] = 'existing_code';
    metadata['source'] = source;
    metadata['draft'] = true;
    parsed['metadata'] = metadata;
    writeFileSync(specPath, yamlStringify(parsed, { sortMapEntries: true }), 'utf8');
}
/**
 * Best-effort resolution of the plugin root from the running `harness`
 * binary location — climb until a `.claude-plugin/plugin.json` is found.
 */
function resolvePluginRootFromBinary() {
    // The bundle is at <plugin-root>/dist/cli/harness.bundle.mjs and the
    // shim at <plugin-root>/bin/harness; either way `__dirname` (or the
    // entry script directory) sits two levels under the plugin root.
    const entry = process.argv[1] ?? '.';
    let dir = resolvePath(entry, '..');
    for (let i = 0; i < 6; i += 1) {
        if (existsSync(join(dir, '.claude-plugin', 'plugin.json'))) {
            return dir;
        }
        const parent = resolvePath(dir, '..');
        if (parent === dir)
            break;
        dir = parent;
    }
    throw new Error(`init: could not auto-resolve plugin root from ${entry}. ` +
        'Pass --plugin-root <path> explicitly.');
}
/** Entry point — parses argv and dispatches. */
export function main(argv = process.argv) {
    const program = buildProgram();
    program.parse([...argv]);
}
//# sourceMappingURL=harness.js.map