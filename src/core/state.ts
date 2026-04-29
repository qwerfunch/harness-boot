/**
 * State helpers for `.harness/state.yaml` (F-086 port of
 * `scripts/core/state.py`).
 *
 * Schema (v2.3):
 *
 *     version: "2.3"
 *     schema_version: "2.3"
 *     features:
 *       - id: F-NNN
 *         status: planned | in_progress | blocked | done | archived
 *         gates:
 *           gate_0: { last_result: pass | fail | skipped, ts, note }
 *           ...
 *         evidence:
 *           - { ts, kind, summary }
 *         skipped_agents: [ { agent, reason, ts }, ... ]   (optional)
 *         started_at: null | iso8601
 *         completed_at: null | iso8601
 *     session:
 *       started_at: null | iso8601
 *       last_command: ""
 *       last_gate_passed: null | gate name
 *       active_feature_id: null | F-NNN
 *
 * Behaviour preservation: this port targets **semantic-equivalence
 * parity** rather than byte-equal YAML output (PyYAML and eemeli/yaml
 * have different scalar quoting rules). What is byte-equal: the data
 * shape after a round-trip and the Iron Law math (pure logic — see
 * {@link countDeclaredEvidence}).
 *
 * @module state
 */

import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

/** Permitted gate result values. */
export type GateResult = 'pass' | 'fail' | 'skipped';

/** Permitted feature status values. */
export type FeatureStatus = 'planned' | 'in_progress' | 'blocked' | 'done' | 'archived';

/** All valid feature statuses (runtime check + iteration). */
export const FEATURE_STATUSES: readonly FeatureStatus[] = [
  'planned',
  'in_progress',
  'blocked',
  'done',
  'archived',
] as const;

/** All valid gate result values (runtime check). */
export const GATE_RESULTS: readonly GateResult[] = ['pass', 'fail', 'skipped'] as const;

/**
 * Iron Law (v0.9.3) — evidence kinds emitted by gate runners.
 *
 * These do **not** count toward Iron Law because the rule's purpose is
 * to surface human-volition signals (manual checks, reviews, user
 * feedback, tests the author chose to record). Kinds outside this set —
 * including `test`, `manual_check`, `user_feedback`, `reviewer_check`,
 * `generic`, `blocker`, `hotfix` — are declared. The taxonomy is
 * kind-based rather than a new field so existing state.yaml files stay
 * forward-compatible with no migration.
 */
export const AUTOMATIC_EVIDENCE_KINDS: ReadonlySet<string> = new Set(['gate_run', 'gate_auto_run']);

/**
 * Iron Law default trailing window in days for declared evidence count.
 * v0.9.3 hardcoded 7; later releases may override via
 * `.harness/.config.toml`.
 */
export const IRON_LAW_WINDOW_DAYS = 7;

/** One gate result entry under a feature's `gates` map. */
export interface GateRecord {
  last_result: GateResult;
  ts: string;
  note: string;
}

/** One evidence row under a feature's `evidence` array. */
export interface EvidenceEntry {
  ts: string;
  kind: string;
  summary: string;
  [key: string]: unknown;
}

/** One row under a feature's optional `skipped_agents` array. */
export interface SkippedAgentEntry {
  agent: string;
  reason: string;
  ts: string;
  [key: string]: unknown;
}

/** A single feature record inside `state.yaml`. */
export interface Feature {
  id: string;
  status: FeatureStatus;
  gates: Record<string, GateRecord>;
  evidence: EvidenceEntry[];
  started_at: string | null;
  completed_at: string | null;
  skipped_agents?: SkippedAgentEntry[];
  [key: string]: unknown;
}

/** The session block at the bottom of `state.yaml`. */
export interface Session {
  started_at: string | null;
  last_command: string;
  last_gate_passed: string | null;
  active_feature_id: string | null;
  [key: string]: unknown;
}

/** Top-level shape of `state.yaml`. */
export interface StateData {
  version: string;
  schema_version: string;
  features: Feature[];
  session: Session;
  [key: string]: unknown;
}

/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
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

/** Returns a brand-new default state shape (used when file is absent). */
function defaultState(): StateData {
  return {
    version: '2.3',
    schema_version: '2.3',
    features: [],
    session: {
      started_at: null,
      last_command: '',
      last_gate_passed: null,
      active_feature_id: null,
    },
  };
}

/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Optional positional input shared by record-style mutators. */
export interface RecordGateOptions {
  note?: string;
  ts?: string;
}

/** Optional positional input shared by evidence/skipped-agent mutators. */
export interface AddEntryOptions {
  ts?: string;
}

/** Optional input for {@link countDeclaredEvidence}. */
export interface CountDeclaredEvidenceOptions {
  windowDays?: number;
  now?: Date;
}

/**
 * Mutable view of a single `.harness/state.yaml` file.
 *
 * Lifecycle:
 *
 *   1. {@link State.load} reads the file (or initializes a default
 *      shape when missing).
 *   2. Callers mutate via the helper methods (`setStatus`,
 *      `recordGateResult`, `addEvidence`, ...).
 *   3. {@link State.save} writes the YAML back to disk.
 *
 * The class deliberately does not auto-save on every mutation to
 * preserve atomic update semantics — callers can batch related changes
 * and persist them in one shot.
 */
export class State {
  /** Resolved absolute path of `state.yaml` for this view. */
  readonly path: string;

  /** In-memory state document. Mutations are visible here immediately. */
  data: StateData;

  /** Construct directly when the path and data are already resolved. */
  constructor(path: string, data: StateData) {
    this.path = path;
    this.data = data;
  }

  /**
   * Reads `<harnessDir>/state.yaml` and returns a {@link State} view.
   *
   * When the file does not exist the view is initialized with the
   * default schema; nothing is written to disk until
   * {@link State.save} is called.
   *
   * @param harnessDir - Path to the project's `.harness/` directory.
   * @returns A new `State` instance.
   */
  static load(harnessDir: string): State {
    const path = join(harnessDir, 'state.yaml');
    let data: StateData;

    if (existsSync(path) && statSync(path).isFile()) {
      const raw = readFileSync(path, 'utf-8');
      const parsed: unknown = yamlParse(raw);
      if (isPlainObject(parsed)) {
        data = parsed as StateData;
      } else {
        data = defaultState();
      }
    } else {
      data = defaultState();
    }

    // Defensive defaults — guard against truncated or partially-edited files.
    if (!isPlainObject(data.session as unknown)) {
      data.session = defaultState().session;
    }
    if (!Array.isArray(data.features)) {
      data.features = [];
    }
    return new State(path, data);
  }

  /** Persist the in-memory shape back to disk. */
  save(): void {
    mkdirSync(dirname(this.path), {recursive: true});
    const out = yamlStringify(this.data, {
      // Preserve insertion order — Python's PyYAML used `sort_keys=False`.
      sortMapEntries: false,
      // Avoid extra indent on sequences inside maps so the output stays
      // close to PyYAML's `default_flow_style=False` block style.
      indentSeq: false,
      // No hard wrap — long strings stay on one line.
      lineWidth: 0,
    });
    writeFileSync(this.path, out, 'utf-8');
  }

  // --------------------------------------------------------------------
  // Feature helpers
  // --------------------------------------------------------------------

  /** All feature ids currently in the `features[]` array. */
  featureIds(): string[] {
    const ids: string[] = [];
    for (const f of this.data.features) {
      if (isPlainObject(f) && typeof f.id === 'string') {
        ids.push(f.id);
      }
    }
    return ids;
  }

  /** Returns the feature record matching `fid`, or `null`. */
  getFeature(fid: string): Feature | null {
    for (const f of this.data.features) {
      if (isPlainObject(f) && f.id === fid) {
        return f as Feature;
      }
    }
    return null;
  }

  /**
   * Returns the feature record for `fid`, inserting a `planned`
   * placeholder when the id is new.
   *
   * Identity is preserved across calls — mutations on the returned
   * object are visible on the next {@link State.save}.
   */
  ensureFeature(fid: string): Feature {
    const existing = this.getFeature(fid);
    if (existing !== null) {
      return existing;
    }
    const entry: Feature = {
      id: fid,
      status: 'planned',
      gates: {},
      evidence: [],
      started_at: null,
      completed_at: null,
    };
    this.data.features.push(entry);
    return entry;
  }

  /**
   * Sets `feature.status` for `fid`, updating `started_at` /
   * `completed_at` lifecycle timestamps when the transition warrants.
   *
   * Resetting to `planned` is allowed but does not clear timestamps —
   * the user can audit prior progress. Throws on unknown status.
   */
  setStatus(fid: string, status: FeatureStatus): void {
    if (!FEATURE_STATUSES.includes(status)) {
      throw new Error(
        `invalid status '${status}' (expected one of ${FEATURE_STATUSES.join(', ')})`,
      );
    }
    const f = this.ensureFeature(fid);
    f.status = status;
    const ts = nowIso();
    if (status === 'in_progress' && f.started_at === null) {
      f.started_at = ts;
    }
    if (status === 'done' && f.completed_at === null) {
      f.completed_at = ts;
    }
  }

  /**
   * Writes `feature.gates[gateName]` for `fid` and updates
   * `session.last_gate_passed` on `pass`.
   *
   * Throws on unknown gate result.
   */
  recordGateResult(
    fid: string,
    gateName: string,
    result: GateResult,
    options: RecordGateOptions = {},
  ): void {
    if (!GATE_RESULTS.includes(result)) {
      throw new Error(`invalid gate result '${result}'`);
    }
    const f = this.ensureFeature(fid);
    if (!isPlainObject(f.gates)) {
      f.gates = {};
    }
    f.gates[gateName] = {
      last_result: result,
      ts: options.ts ?? nowIso(),
      note: options.note ?? '',
    };
    if (result === 'pass') {
      this.data.session.last_gate_passed = gateName;
    }
  }

  /**
   * Appends an evidence row to `features[fid].evidence`.
   *
   * Evidence is the unit Iron Law counts; see
   * {@link countDeclaredEvidence} for what qualifies as declared.
   */
  addEvidence(fid: string, kind: string, summary: string, options: AddEntryOptions = {}): void {
    const f = this.ensureFeature(fid);
    if (!Array.isArray(f.evidence)) {
      f.evidence = [];
    }
    f.evidence.push({
      ts: options.ts ?? nowIso(),
      kind,
      summary,
    });
  }

  /**
   * Records that an agent was intentionally skipped for a feature.
   *
   * v0.5 routing documented `skipped_agents[]` but the original
   * Python state module never implemented the writer — orchestrator
   * skip decisions left no audit trail. v0.7.2 added the API; this
   * port preserves it.
   *
   * @throws when `agent` is empty or `reason` is empty (silent skips
   *   defeat the audit purpose).
   */
  addSkippedAgent(
    fid: string,
    agent: string,
    reason: string,
    options: AddEntryOptions = {},
  ): void {
    if (!agent) {
      throw new Error('agent name required');
    }
    if (!reason) {
      throw new Error('reason required — silent skips defeat the audit purpose');
    }
    const f = this.ensureFeature(fid);
    let skipped = f.skipped_agents;
    if (!Array.isArray(skipped)) {
      skipped = [];
      f.skipped_agents = skipped;
    }
    skipped.push({
      agent,
      reason,
      ts: options.ts ?? nowIso(),
    });
  }

  /** Returns a shallow copy of the skipped-agents log for `fid`. */
  getSkippedAgents(fid: string): SkippedAgentEntry[] {
    const f = this.getFeature(fid);
    if (f === null) {
      return [];
    }
    if (!Array.isArray(f.skipped_agents)) {
      return [];
    }
    return [...f.skipped_agents];
  }

  // --------------------------------------------------------------------
  // Session helpers
  // --------------------------------------------------------------------

  /**
   * Sets `session.active_feature_id`.
   *
   * Auto-registers the feature as `planned` when the id is unknown
   * (mirrors Python so a typo'd activate does not corrupt the file).
   */
  setActive(fid: string | null): void {
    if (fid !== null && this.getFeature(fid) === null) {
      this.ensureFeature(fid);
    }
    this.data.session.active_feature_id = fid;
  }

  /**
   * Removes a feature from `features[]`.
   *
   * Returns `true` when something was removed. Also clears
   * `session.active_feature_id` when it pointed at the removed id.
   */
  removeFeature(fid: string): boolean {
    const before = this.data.features.length;
    this.data.features = this.data.features.filter(
      (f) => !(isPlainObject(f) && f.id === fid),
    );
    const removed = this.data.features.length < before;
    if (removed && this.data.session.active_feature_id === fid) {
      this.data.session.active_feature_id = null;
    }
    return removed;
  }

  /** Returns ids of all features whose status is `in_progress`. */
  featuresInProgress(): string[] {
    const out: string[] = [];
    for (const f of this.data.features) {
      if (isPlainObject(f) && f.status === 'in_progress' && typeof f.id === 'string') {
        out.push(f.id);
      }
    }
    return out;
  }

  /**
   * Records the most recent slash-command invocation and stamps
   * `session.started_at` on the very first call.
   */
  setLastCommand(command: string): void {
    this.data.session.last_command = command;
    if (this.data.session.started_at === null) {
      this.data.session.started_at = nowIso();
    }
  }

  // --------------------------------------------------------------------
  // Summary helpers (used by status / check / dashboards)
  // --------------------------------------------------------------------

  /** Returns a `{status: count}` map for each FEATURE_STATUSES entry. */
  featureCounts(): Record<FeatureStatus, number> {
    const counts: Record<FeatureStatus, number> = {
      planned: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
      archived: 0,
    };
    for (const f of this.data.features) {
      if (!isPlainObject(f)) {
        continue;
      }
      const status = (f.status ?? 'planned') as FeatureStatus;
      if (status in counts) {
        counts[status] += 1;
      }
    }
    return counts;
  }

  /**
   * Returns a deep-cloned snapshot of the in-memory state.
   *
   * Used by `/harness:status --json` and parity tests that want to
   * compare two states without aliasing concerns.
   */
  snapshot(): StateData {
    return structuredClone(this.data);
  }
}

/**
 * Returns `true` when an evidence entry counts as a declared signal.
 *
 * Declared = human-volition record of verification. Automatic = gate
 * runner byproduct. Entries missing `kind` are treated as declared
 * (conservative — unclassified signals are assumed intentional).
 *
 * See {@link AUTOMATIC_EVIDENCE_KINDS} for the exhaustive automatic
 * list.
 */
export function isDeclaredEvidence(ev: unknown): boolean {
  if (!isPlainObject(ev)) {
    return false;
  }
  const kind = ev.kind;
  if (typeof kind !== 'string') {
    return true;
  }
  return !AUTOMATIC_EVIDENCE_KINDS.has(kind);
}

/**
 * Parses an ISO 8601 `ts` string into a `Date`.
 *
 * Returns `null` on any failure (non-string, malformed, NaN). The
 * Python implementation uses `datetime.fromisoformat` with a `Z` →
 * `+00:00` swap; the JS `Date` parser handles `Z` natively, so we just
 * delegate.
 */
function parseTs(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}

/**
 * Counts declared evidence entries for `feature` within the trailing
 * time window.
 *
 * Iron Law (v0.9.3): at `/harness-boot:work --complete` time, this
 * function tallies how many declared signals the feature has accrued
 * in the last `windowDays` days. Entries with unparseable or missing
 * `ts` count as recent (conservative — the absence of a timestamp
 * should not penalize the author).
 *
 * @param feature - One `state.yaml.features[]` record.
 * @param options.windowDays - Trailing window size; defaults to
 *   {@link IRON_LAW_WINDOW_DAYS}.
 * @param options.now - Override clock for tests; defaults to current
 *   UTC time.
 * @returns Count of qualifying entries (always `>= 0`).
 */
export function countDeclaredEvidence(
  feature: unknown,
  options: CountDeclaredEvidenceOptions = {},
): number {
  if (!isPlainObject(feature)) {
    return 0;
  }
  const windowDays = options.windowDays ?? IRON_LAW_WINDOW_DAYS;
  const now = options.now ?? new Date();
  const cutoffMs = now.getTime() - Math.max(windowDays, 0) * 24 * 60 * 60 * 1000;
  const evidence = feature.evidence;
  if (!Array.isArray(evidence)) {
    return 0;
  }
  let count = 0;
  for (const ev of evidence) {
    if (!isDeclaredEvidence(ev)) {
      continue;
    }
    const ts = parseTs((ev as Record<string, unknown>).ts);
    if (ts !== null && ts.getTime() < cutoffMs) {
      continue;
    }
    count += 1;
  }
  return count;
}
