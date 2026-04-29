/**
 * `/harness:work` lifecycle orchestrator (F-102 port of
 * `scripts/work.py`).
 *
 * Largest single port — wires together state mutation, gate runner,
 * drift detection, and ceremony auto-wires. Implements the four-verb
 * cycle: activate → record_gate → add_evidence → complete.
 *
 * Iron Law (BR-004) — `complete()` requires:
 *   1. `gate_5.last_result === 'pass'`
 *   2. Trailing-window declared evidence ≥ mode threshold
 *      (prototype=1, product=3; `--hotfix-reason` collapses both
 *      to 1 and records the reason as a hotfix evidence entry).
 *   3. Working tree clean (whitelist:
 *      .harness/state.yaml, .harness/_workspace/*, CHANGELOG.md).
 *   4. No blocking drift findings (Code · Stale ·
 *      AnchorIntegration · Coverage with severity='error').
 *
 * Auto-wires fired from activate / recordGate / addEvidence /
 * runAndRecordGate / complete:
 *   - kickoff (on activate)
 *   - design-review (3-condition AND on every state mutation)
 *   - retro (on complete success)
 *
 * @module work
 */

import {appendFileSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, resolve as resolvePath} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parse as yamlParse} from 'yaml';

import {runBlockingCheck} from './check.js';
import {STANDARD_GATES} from './core/gates.js';
import {resolveMode} from './core/projectMode.js';
import {
  IRON_LAW_WINDOW_DAYS,
  State,
  countDeclaredEvidence,
  type Feature,
} from './core/state.js';
import {generateDesignReview} from './ceremonies/designReview.js';
import {
  agentsForShapes,
  detectShapes,
  generateKickoff,
  hasAudioFlag,
  parallelGroupsForShapes,
  renderStyleBlock,
} from './ceremonies/kickoff.js';
import {generateRetro} from './ceremonies/retro.js';
import {runGate, type GateResult} from './gate/runner.js';
import {tryInitialSync} from './sync.js';

/** Friendly labels for gate identifiers (F-061 user-facing display). */
const GATE_FRIENDLY: Readonly<Record<string, string>> = {
  gate_0: 'tests',
  gate_1: 'type check',
  gate_2: 'lint',
  gate_3: 'coverage',
  gate_4: 'commit check',
  gate_5: 'smoke run',
  gate_perf: 'performance',
};

function friendlyGate(gateName: string): string {
  const label = GATE_FRIENDLY[gateName];
  return label ? `${label} (${gateName})` : gateName;
}

/** Iron Law minimum declared-evidence count per project mode. */
const IRON_LAW_REQUIRED: Readonly<Record<string, number>> = {prototype: 1, product: 3};

/** F-048 blocking drift kinds for the complete() fast path. */
const BLOCKING_DRIFT_KINDS: ReadonlySet<string> = new Set([
  'Code',
  'Stale',
  'AnchorIntegration',
  'Coverage',
]);

/** Outcome of a single work-verb call. */
export interface WorkResult {
  feature_id: string;
  action: string;
  current_status: string;
  gates_passed: string[];
  gates_failed: string[];
  evidence_count: number;
  message: string;
  routed_agents: string[];
  parallel_groups: string[][];
}

/** Optional input for {@link activate}. */
export interface ActivateOptions {
  disableFog?: boolean;
}

/** Optional input for {@link recordGate}. */
export interface RecordGateOptions {
  note?: string;
}

/** Optional input for {@link block}. */
export interface BlockOptions {
  kind?: string;
}

/** Optional input for {@link complete}. */
export interface CompleteOptions {
  hotfixReason?: string | null;
}

/** Optional input for {@link archive}. */
export interface ArchiveOptions {
  supersededBy?: string | null;
  reason?: string | null;
}

/** Optional input for {@link runAndRecordGate}. */
export interface RunAndRecordGateOptions {
  projectRoot?: string;
  overrideCommand?: ReadonlyArray<string> | null;
  timeoutSec?: number;
  addEvidenceOnPass?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function nowIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

/** Mirrors Python's `json.dumps(obj, ensure_ascii=False)` separators. */
function pythonStyleJsonStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`work: non-finite number cannot be serialized (${String(value)}).`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify(v)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const pairs = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`,
    );
    return `{${pairs.join(', ')}}`;
  }
  throw new TypeError(`work: unsupported value type ${typeof value}.`);
}

function appendEvent(harnessDir: string, event: Record<string, unknown>): void {
  const logPath = join(harnessDir, 'events.log');
  mkdirSync(dirname(logPath), {recursive: true});
  appendFileSync(logPath, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}

function loadSpec(harnessDir: string): Record<string, unknown> | null {
  const path = join(harnessDir, 'spec.yaml');
  if (!isFile(path)) {
    return null;
  }
  try {
    const parsed: unknown = yamlParse(readFileSync(path, 'utf-8'));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function findFeature(spec: Record<string, unknown>, fid: string): Record<string, unknown> | null {
  const features = spec['features'];
  if (!Array.isArray(features)) {
    return null;
  }
  for (const f of features) {
    if (isPlainObject(f) && f['id'] === fid) {
      return f;
    }
  }
  return null;
}

function summarize(state: State, fid: string): WorkResult {
  const f: Feature | null = state.getFeature(fid);
  const gates = f?.gates ?? {};
  const passed: string[] = [];
  const failed: string[] = [];
  for (const [g, v] of Object.entries(gates)) {
    if (isPlainObject(v) && v['last_result'] === 'pass') {
      passed.push(g);
    } else if (isPlainObject(v) && v['last_result'] === 'fail') {
      failed.push(g);
    }
  }
  return {
    feature_id: fid,
    action: 'queried',
    current_status: f?.status ?? 'planned',
    gates_passed: passed,
    gates_failed: failed,
    evidence_count: Array.isArray(f?.evidence) ? f!.evidence.length : 0,
    message: '',
    routed_agents: [],
    parallel_groups: [],
  };
}

function autowireInitialSync(harnessDir: string): void {
  try {
    const result = tryInitialSync(harnessDir);
    if (!result.ok && result.reason !== 'spec.yaml missing') {
      process.stderr.write(
        `[warn] initial sync auto-wire failed: ${result.reason} — ` +
          `run \`npm run sync -- --harness-dir ${harnessDir}\` manually\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `[warn] initial sync auto-wire failed: ${(err as Error).message}\n`,
    );
  }
}

function autowireKickoff(harnessDir: string, fid: string, force: boolean = false): void {
  const spec = loadSpec(harnessDir);
  if (spec === null) {
    return;
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return;
  }
  try {
    const shapes = detectShapes(feature, spec);
    if (shapes.length === 0) {
      return;
    }
    let styleBlock = '';
    try {
      styleBlock = renderStyleBlock(harnessDir, feature);
    } catch {
      styleBlock = '';
    }
    generateKickoff(harnessDir, fid, shapes, {
      hasAudio: hasAudioFlag(feature),
      force,
      mode: resolveMode(spec),
      styleBlock,
    });
  } catch {
    // Silent — auto-wire failures must never crash activate.
  }
}

function autowireRetro(harnessDir: string, fid: string, force: boolean = false): void {
  const spec = loadSpec(harnessDir);
  if (spec === null) {
    return;
  }
  try {
    generateRetro(harnessDir, fid, {
      force,
      mode: resolveMode(spec),
    });
  } catch {
    // Silent.
  }
}

function autowireDesignReview(harnessDir: string, fid: string, force: boolean = false): void {
  const spec = loadSpec(harnessDir);
  if (spec === null) {
    return;
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return;
  }
  const ui = isPlainObject(feature['ui_surface']) ? (feature['ui_surface'] as Record<string, unknown>) : {};
  if (ui['present'] !== true) {
    return;
  }
  const flowsPath = join(harnessDir, '_workspace', 'design', 'flows.md');
  if (!isFile(flowsPath)) {
    return;
  }
  const reviewPath = join(harnessDir, '_workspace', 'design-review', `${fid}.md`);
  if (isFile(reviewPath) && !force) {
    return;
  }
  if (resolveMode(spec) === 'prototype' && !force) {
    return;
  }
  try {
    generateDesignReview(harnessDir, fid, {hasAudio: hasAudioFlag(feature)});
  } catch {
    // Silent.
  }
}

function resolveRouting(harnessDir: string, fid: string): {agents: string[]; groups: string[][]} {
  const spec = loadSpec(harnessDir);
  if (spec === null) {
    return {agents: [], groups: []};
  }
  const feature = findFeature(spec, fid);
  if (feature === null) {
    return {agents: [], groups: []};
  }
  try {
    const shapes = detectShapes(feature, spec);
    if (shapes.length === 0) {
      return {agents: [], groups: []};
    }
    const audio = hasAudioFlag(feature);
    return {
      agents: agentsForShapes(shapes, audio),
      groups: parallelGroupsForShapes(shapes, audio),
    };
  } catch {
    return {agents: [], groups: []};
  }
}

function warnIfGhost(harnessDir: string, fid: string): void {
  const spec = loadSpec(harnessDir);
  if (spec === null) {
    return;
  }
  if (findFeature(spec, fid) === null) {
    process.stderr.write(
      `warn: ${fid} not defined in spec.yaml — proceeding as ghost feature. ` +
        `Use /harness:spec to register it or \`--remove ${fid}\` to undo.\n`,
    );
  }
}

function warnIfConcurrent(state: State, fid: string): void {
  const others = state.featuresInProgress().filter((f) => f !== fid);
  if (others.length > 0) {
    process.stderr.write(
      `warn: other feature(s) still in_progress: ${others.join(', ')}. ` +
        'Finish or block before switching, or ignore to work in parallel.\n',
    );
  }
}

/** Activates a feature — planned → in_progress + auto-wires. */
export function activate(
  harnessDir: string,
  fid: string,
  options: ActivateOptions = {},
): WorkResult {
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  if (f.status === 'done') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = `${fid} is already done — no re-activation`;
    return res;
  }

  warnIfGhost(harnessDir, fid);
  warnIfConcurrent(state, fid);

  state.setActive(fid);
  if (f.status === undefined || f.status === 'planned' || f.status === null) {
    state.setStatus(fid, 'in_progress');
  }
  state.setLastCommand(`/harness:work ${fid}`);
  state.save();

  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'feature_activated',
    feature: fid,
    status: state.getFeature(fid)!.status,
  });

  autowireInitialSync(harnessDir);
  // Quant-lint and fog-clear auto-wires are deferred until their TS deps land
  // (spec/quantClaims, scan/chapterWriter, scan/styleFingerprint). The
  // deferred autowires were never Iron-Law gating — only stderr hints.
  void options.disableFog;
  autowireKickoff(harnessDir, fid);
  autowireDesignReview(harnessDir, fid);

  const res = summarize(state, fid);
  res.action = 'activated';
  const routing = resolveRouting(harnessDir, fid);
  res.routed_agents = routing.agents;
  res.parallel_groups = routing.groups;
  return res;
}

/** Records a gate result on a feature. */
export function recordGate(
  harnessDir: string,
  fid: string,
  gateName: string,
  result: GateResult,
  options: RecordGateOptions = {},
): WorkResult {
  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  state.recordGateResult(fid, gateName, result, {note: options.note ?? ''});
  state.save();

  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'gate_recorded',
    feature: fid,
    gate: gateName,
    result,
    note: options.note ?? '',
  });
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = 'gate_recorded';
  return res;
}

/** Appends an evidence entry. */
export function addEvidence(
  harnessDir: string,
  fid: string,
  kind: string,
  summary: string,
): WorkResult {
  const state = State.load(harnessDir);
  state.addEvidence(fid, kind, summary);
  state.save();

  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'evidence_added',
    feature: fid,
    kind,
    summary,
  });
  autowireDesignReview(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = 'evidence_added';
  return res;
}

/** Marks a feature as blocked + records the reason. */
export function block(
  harnessDir: string,
  fid: string,
  reason: string,
  options: BlockOptions = {},
): WorkResult {
  const kind = options.kind ?? 'blocker';
  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  state.setStatus(fid, 'blocked');
  state.addEvidence(fid, kind, reason);
  state.save();

  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'feature_blocked',
    feature: fid,
    reason,
  });
  const res = summarize(state, fid);
  res.action = 'blocked';
  res.message = reason;
  return res;
}

function projectIsGitRepo(projectRoot: string): boolean {
  try {
    statSync(join(projectRoot, '.git'));
    return true;
  } catch {
    return false;
  }
}

function isHarnessOwnedPath(path: string): boolean {
  if (path === '.harness/state.yaml') {
    return true;
  }
  if (path.startsWith('.harness/_workspace/')) {
    return true;
  }
  return path === 'CHANGELOG.md';
}

function workingTreeDirty(projectRoot: string): boolean {
  let proc;
  try {
    proc = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
  } catch {
    return false;
  }
  if (proc.status !== 0 || typeof proc.stdout !== 'string') {
    return false;
  }
  for (const line of proc.stdout.split('\n')) {
    if (line.length < 4) {
      continue;
    }
    let path = line.slice(3);
    if (path.includes(' -> ')) {
      path = path.split(' -> ', 2)[1] ?? path;
    }
    path = path.trim().replace(/^"|"$/g, '');
    if (!isHarnessOwnedPath(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Transitions a feature to `done`, enforcing the BR-004 Iron Law.
 *
 * Rejection paths return `action: 'queried'` with a human-readable
 * `message`. Successful completion emits a `feature_done` event and
 * fires the retro auto-wire.
 */
export function complete(
  harnessDir: string,
  fid: string,
  options: CompleteOptions = {},
): WorkResult {
  const hotfixReason = options.hotfixReason ?? null;
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  if (f.status === 'done') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = `${fid} is already done — no re-completion`;
    return res;
  }
  const gates = f.gates ?? {};
  const gate5 = gates['gate_5'];
  if (!isPlainObject(gate5) || gate5['last_result'] !== 'pass') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = `cannot complete — ${friendlyGate('gate_5')} is not PASS yet`;
    return res;
  }

  // Working-tree-clean guard.
  const projectRoot = resolvePath(harnessDir, '..');
  if (projectIsGitRepo(projectRoot) && workingTreeDirty(projectRoot)) {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message =
      'cannot complete — working tree has uncommitted user changes. ' +
      'Canonical sequence: --evidence → git commit → --complete. ' +
      'Committing while the feature is still in_progress lets the ' +
      'pre-commit hook (F-034) pass naturally; --gate gate_4 may ' +
      'be recorded post-commit if you want the audit trail. ' +
      '(.harness/state.yaml, .harness/_workspace/*, CHANGELOG.md ' +
      'are whitelisted and do not count as dirty.)';
    return res;
  }

  // F-048 drift × Iron Law gating.
  if (!hotfixReason) {
    try {
      const driftReport = runBlockingCheck(harnessDir);
      const blocking = driftReport.findings.filter(
        (d) => d.severity === 'error' && BLOCKING_DRIFT_KINDS.has(d.kind),
      );
      if (blocking.length > 0) {
        const res = summarize(state, fid);
        res.action = 'queried';
        const kinds = [...new Set(blocking.map((d) => d.kind))].sort();
        res.message =
          `cannot complete — ${blocking.length} blocking drift(s) ` +
          `(${kinds.join(', ')}). Run ` +
          `\`npm run check -- --harness-dir ${harnessDir}\` for details, ` +
          'fix, or use `--hotfix-reason` for emergency.';
        return res;
      }
    } catch {
      // Silent fallback — gate_5 already proved runtime smoke.
    }
  }

  const spec = loadSpec(harnessDir);
  const mode = resolveMode(spec);
  const requiredDefault = IRON_LAW_REQUIRED[mode]!;
  const required = hotfixReason ? 1 : requiredDefault;

  // v0.10.3 product-mode strict — any failed gate blocks complete.
  if (mode === 'product' && !hotfixReason) {
    const failedGates: string[] = [];
    for (const [g, v] of Object.entries(gates)) {
      if (isPlainObject(v) && v['last_result'] === 'fail') {
        failedGates.push(g);
      }
    }
    failedGates.sort();
    if (failedGates.length > 0) {
      const res = summarize(state, fid);
      res.action = 'queried';
      res.message =
        'cannot complete — product mode strict: declared gate(s) failing — ' +
        `${failedGates.join(', ')}. Re-run with --run-gate after fixing, ` +
        'or use --hotfix-reason for emergency override.';
      return res;
    }
  }

  if (hotfixReason !== null && hotfixReason.trim().length === 0) {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = 'hotfix reason cannot be empty — describe the emergency briefly';
    return res;
  }
  if (hotfixReason !== null) {
    state.addEvidence(fid, 'hotfix', hotfixReason.trim());
  }

  const featureNow = state.getFeature(fid) ?? f;
  const declared = countDeclaredEvidence(featureNow, {windowDays: IRON_LAW_WINDOW_DAYS});
  if (declared < required) {
    if (hotfixReason !== null) {
      // Roll back the hotfix evidence so a rejected complete leaves no noise.
      const evidenceList = featureNow.evidence;
      if (Array.isArray(evidenceList) && evidenceList.length > 0) {
        evidenceList.pop();
      }
      state.save();
    }
    const res = summarize(state, fid);
    res.action = 'queried';
    const reasonSuffix = hotfixReason !== null ? ', hotfix' : '';
    res.message =
      `cannot complete — Iron Law: ${declared}/${required} declared evidence ` +
      `in last ${IRON_LAW_WINDOW_DAYS} days (mode: ${mode}${reasonSuffix}). ` +
      'Add more with --evidence, or use --hotfix-reason for emergency override.';
    return res;
  }

  state.setStatus(fid, 'done');
  if (state.data.session.active_feature_id === fid) {
    state.setActive(null);
  }
  state.save();

  const event: Record<string, unknown> = {
    ts: nowIso(),
    type: 'feature_done',
    feature: fid,
    iron_law_mode: mode,
    declared_count: declared,
    required,
  };
  if (hotfixReason !== null) {
    event['hotfix_reason'] = hotfixReason.trim();
  }
  appendEvent(harnessDir, event);
  autowireRetro(harnessDir, fid);
  const res = summarize(state, fid);
  res.action = 'completed';
  return res;
}

/** Transitions a done feature to archived (with optional supersedes). */
export function archive(
  harnessDir: string,
  fid: string,
  options: ArchiveOptions = {},
): WorkResult {
  const state = State.load(harnessDir);
  const f = state.ensureFeature(fid);
  const currentStatus = f.status;

  if (currentStatus === 'archived') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = `${fid} is already archived — no re-archive`;
    return res;
  }
  if (currentStatus !== 'done') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message =
      `cannot archive — ${fid}.status='${currentStatus}'. ` +
      "Only 'done' features can be archived (shipped is shipped).";
    return res;
  }

  let supersededBy = options.supersededBy ?? null;
  if (supersededBy !== null) {
    const sb = supersededBy.trim();
    if (sb.length === 0) {
      const res = summarize(state, fid);
      res.action = 'queried';
      res.message = '--superseded-by cannot be empty';
      return res;
    }
    if (sb === fid) {
      const res = summarize(state, fid);
      res.action = 'queried';
      res.message = `--superseded-by cannot reference self (${fid})`;
      return res;
    }
    const spec = loadSpec(harnessDir) ?? {};
    const specIds = new Set<string>();
    for (const entry of (spec['features'] as unknown[]) ?? []) {
      if (isPlainObject(entry) && typeof entry['id'] === 'string') {
        specIds.add(entry['id']);
      }
    }
    if (!specIds.has(sb)) {
      const res = summarize(state, fid);
      res.action = 'queried';
      res.message =
        `--superseded-by ${sb} not found in spec.yaml features[]. ` +
        'Add the replacement feature to spec first.';
      return res;
    }
    supersededBy = sb;
  }

  state.setStatus(fid, 'archived');
  if (state.data.session.active_feature_id === fid) {
    state.setActive(null);
  }
  state.save();

  const event: Record<string, unknown> = {
    ts: nowIso(),
    type: 'feature_archived',
    feature: fid,
  };
  if (supersededBy !== null && supersededBy !== '') {
    event['superseded_by'] = supersededBy;
  }
  if (options.reason !== undefined && options.reason !== null) {
    event['reason'] = options.reason.trim();
  }
  appendEvent(harnessDir, event);
  autowireRetro(harnessDir, fid, true);

  const res = summarize(state, fid);
  res.action = 'archived';
  const suffixParts: string[] = [];
  if (supersededBy !== null && supersededBy !== '') {
    suffixParts.push(`superseded_by=${supersededBy}`);
  }
  if (options.reason) {
    suffixParts.push(`reason='${options.reason.trim()}'`);
  }
  const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(', ')})` : '';
  res.message = `${fid} archived${suffix}`;
  return res;
}

/** Read-only — returns the current active feature, or null. */
export function current(harnessDir: string): WorkResult | null {
  const state = State.load(harnessDir);
  const fid = state.data.session.active_feature_id;
  if (typeof fid !== 'string' || fid.length === 0) {
    return null;
  }
  const res = summarize(state, fid);
  res.action = 'queried';
  return res;
}

/** Clears `session.active_feature_id` without changing feature status. */
export function deactivate(harnessDir: string): WorkResult {
  const state = State.load(harnessDir);
  const fid = state.data.session.active_feature_id;
  if (typeof fid !== 'string' || fid.length === 0) {
    return {
      feature_id: '',
      action: 'queried',
      current_status: '',
      gates_passed: [],
      gates_failed: [],
      evidence_count: 0,
      message: 'no active feature to deactivate',
      routed_agents: [],
      parallel_groups: [],
    };
  }
  state.setActive(null);
  state.save();
  appendEvent(harnessDir, {ts: nowIso(), type: 'feature_deactivated', feature: fid});
  const res = summarize(state, fid);
  res.action = 'deactivated';
  return res;
}

/** Removes a feature entry from state.yaml. Done features are protected. */
export function removeFeature(harnessDir: string, fid: string): WorkResult {
  const state = State.load(harnessDir);
  const f = state.getFeature(fid);
  if (f === null) {
    return {
      feature_id: fid,
      action: 'queried',
      current_status: '',
      gates_passed: [],
      gates_failed: [],
      evidence_count: 0,
      message: `${fid} not in state — nothing to remove`,
      routed_agents: [],
      parallel_groups: [],
    };
  }
  if (f.status === 'done') {
    const res = summarize(state, fid);
    res.action = 'queried';
    res.message = `cannot remove ${fid} — feature is done (audit trail protected)`;
    return res;
  }
  state.removeFeature(fid);
  state.save();
  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'feature_removed',
    feature: fid,
    prior_status: f.status,
  });
  return {
    feature_id: fid,
    action: 'removed',
    current_status: '',
    gates_passed: [],
    gates_failed: [],
    evidence_count: 0,
    message: `${fid} removed from state`,
    routed_agents: [],
    parallel_groups: [],
  };
}

function formatPerformanceBudget(budget: unknown): string {
  if (!isPlainObject(budget) || Object.keys(budget).length === 0) {
    return '';
  }
  const parts: string[] = [];
  const standard = ['lcp_ms', 'inp_ms', 'cls', 'bundle_kb', 'latency_p95_ms', 'memory_rss_mb'];
  for (const key of standard) {
    if (key in budget) {
      parts.push(`${key}=${budget[key]}`);
    }
  }
  const custom = budget['custom'];
  if (Array.isArray(custom)) {
    for (const entry of custom) {
      if (isPlainObject(entry) && 'metric' in entry && 'budget' in entry) {
        parts.push(`${entry['metric']}=${entry['budget']}`);
      }
    }
  }
  return parts.join(' · ');
}

/**
 * Runs a gate via the gate runner, records the result, and (on
 * pass) appends an automatic evidence entry. `gate_perf` pass also
 * embeds the feature's performance_budget into the evidence summary.
 */
export function runAndRecordGate(
  harnessDir: string,
  fid: string,
  gateName: string,
  options: RunAndRecordGateOptions = {},
): WorkResult {
  const projectRoot = options.projectRoot ?? resolvePath(harnessDir, '..');
  const addEvidenceOnPass = options.addEvidenceOnPass ?? true;

  const runResult = runGate(gateName, projectRoot, {
    overrideCommand: options.overrideCommand ?? null,
    harnessDir,
    timeoutSec: options.timeoutSec ?? 300,
  });

  const state = State.load(harnessDir);
  state.ensureFeature(fid);
  let note = runResult.reason;
  if (!note && runResult.command.length > 0) {
    note = `cmd: ${runResult.command.join(' ')}`;
  }
  state.recordGateResult(fid, gateName, runResult.result, {note});

  if (runResult.result === 'pass' && addEvidenceOnPass) {
    let summary = `Gate ${gateName} pass (${runResult.durationSec.toFixed(1)}s)`;
    if (runResult.command.length > 0) {
      summary += ` · cmd: ${runResult.command.join(' ')}`;
    }
    if (gateName === 'gate_perf') {
      const spec = loadSpec(harnessDir);
      const feature = spec !== null ? findFeature(spec, fid) : null;
      const budgetSummary = formatPerformanceBudget(
        feature !== null ? feature['performance_budget'] : null,
      );
      if (budgetSummary.length > 0) {
        summary += ` · budget: ${budgetSummary}`;
      }
    }
    state.addEvidence(fid, 'gate_run', summary);
  }
  state.save();

  appendEvent(harnessDir, {
    ts: nowIso(),
    type: 'gate_auto_run',
    feature: fid,
    gate: gateName,
    result: runResult.result,
    exit_code: runResult.exitCode,
    duration_sec: Math.round(runResult.durationSec * 1000) / 1000,
    reason: runResult.reason,
  });
  autowireDesignReview(harnessDir, fid);

  const res = summarize(state, fid);
  res.action = 'gate_auto_run';
  res.message =
    `${friendlyGate(gateName)} ${runResult.result.toUpperCase()}` +
    (runResult.reason ? ` — ${runResult.reason}` : '');
  return res;
}

// Re-export STANDARD_GATES so callers don't need to reach into core/gates.
export {STANDARD_GATES};
