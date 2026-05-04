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
/** Permitted gate result values. */
export type GateResult = 'pass' | 'fail' | 'skipped';
/** Permitted feature status values. */
export type FeatureStatus = 'planned' | 'in_progress' | 'blocked' | 'done' | 'archived';
/**
 * Permitted goal runtime status values (v0.14.0 — F-118).
 *
 * Goal lifecycle: planning → scaffolded → executing → done. `paused`
 * is a user-initiated pause; `blocked` mirrors the feature-level block
 * up to the goal so the dashboard can highlight stuck goals at a
 * glance.
 */
export type GoalStatus = 'planning' | 'scaffolded' | 'executing' | 'done' | 'paused' | 'blocked';
/** All valid goal status values (runtime check + iteration). */
export declare const GOAL_STATUSES: readonly GoalStatus[];
/** All valid feature statuses (runtime check + iteration). */
export declare const FEATURE_STATUSES: readonly FeatureStatus[];
/** All valid gate result values (runtime check). */
export declare const GATE_RESULTS: readonly GateResult[];
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
export declare const AUTOMATIC_EVIDENCE_KINDS: ReadonlySet<string>;
/**
 * Iron Law default trailing window in days for declared evidence count.
 * v0.9.3 hardcoded 7; later releases may override via
 * `.harness/.config.toml`.
 */
export declare const IRON_LAW_WINDOW_DAYS = 7;
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
/**
 * Per-feature runtime progress within a goal (v0.14.0 — F-118).
 *
 * Mirrors `feature.status` but cached at the goal level so the
 * progress renderer doesn't need to walk `features[]` on every call.
 * The authoritative source is still `features[]`; this is a snapshot.
 */
export type FeatureProgressMap = Record<string, FeatureStatus>;
/**
 * Goal runtime state inside `state.yaml.goals[]` (v0.14.0 — F-118).
 *
 * The forward index lives in `spec.yaml.goals[]` (a Goal definition);
 * this interface is the runtime mirror that tracks execution status,
 * iteration count, and the last halt reason. A Goal cannot be
 * activated unless its definition exists in `spec.yaml.goals[]`.
 */
export interface GoalRuntimeState {
    id: string;
    status: GoalStatus;
    started_at: string | null;
    completed_at: string | null;
    iteration: number;
    elapsed_sec: number;
    feature_progress: FeatureProgressMap;
    last_halt_reason: string | null;
    [key: string]: unknown;
}
/** The session block at the bottom of `state.yaml`. */
export interface Session {
    started_at: string | null;
    last_command: string;
    last_gate_passed: string | null;
    active_feature_id: string | null;
    /**
     * v0.14.0 — F-118. Pointer to the currently active drive goal.
     * Single value (sequential — BR-015 (g)). `null` when no goal is
     * being driven.
     */
    active_goal_id?: string | null;
    [key: string]: unknown;
}
/** Top-level shape of `state.yaml`. */
export interface StateData {
    version: string;
    schema_version: string;
    features: Feature[];
    session: Session;
    /**
     * v0.14.0 — F-118. Drive autonomous-loop runtime mirror.
     * Optional for backward compatibility; legacy state.yaml files
     * load with `goals` undefined and the loader treats it as `[]`.
     */
    goals?: GoalRuntimeState[];
    [key: string]: unknown;
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
export declare class State {
    /** Resolved absolute path of `state.yaml` for this view. */
    readonly path: string;
    /** In-memory state document. Mutations are visible here immediately. */
    data: StateData;
    /** Construct directly when the path and data are already resolved. */
    constructor(path: string, data: StateData);
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
    static load(harnessDir: string): State;
    /** Persist the in-memory shape back to disk. */
    save(): void;
    /** All feature ids currently in the `features[]` array. */
    featureIds(): string[];
    /** Returns the feature record matching `fid`, or `null`. */
    getFeature(fid: string): Feature | null;
    /**
     * Returns the feature record for `fid`, inserting a `planned`
     * placeholder when the id is new.
     *
     * Identity is preserved across calls — mutations on the returned
     * object are visible on the next {@link State.save}.
     */
    ensureFeature(fid: string): Feature;
    /**
     * Sets `feature.status` for `fid`, updating `started_at` /
     * `completed_at` lifecycle timestamps when the transition warrants.
     *
     * Resetting to `planned` is allowed but does not clear timestamps —
     * the user can audit prior progress. Throws on unknown status.
     */
    setStatus(fid: string, status: FeatureStatus): void;
    /**
     * Writes `feature.gates[gateName]` for `fid` and updates
     * `session.last_gate_passed` on `pass`.
     *
     * Throws on unknown gate result.
     */
    recordGateResult(fid: string, gateName: string, result: GateResult, options?: RecordGateOptions): void;
    /**
     * Appends an evidence row to `features[fid].evidence`.
     *
     * Evidence is the unit Iron Law counts; see
     * {@link countDeclaredEvidence} for what qualifies as declared.
     */
    addEvidence(fid: string, kind: string, summary: string, options?: AddEntryOptions): void;
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
    addSkippedAgent(fid: string, agent: string, reason: string, options?: AddEntryOptions): void;
    /** Returns a shallow copy of the skipped-agents log for `fid`. */
    getSkippedAgents(fid: string): SkippedAgentEntry[];
    /**
     * Sets `session.active_feature_id`.
     *
     * Auto-registers the feature as `planned` when the id is unknown
     * (mirrors Python so a typo'd activate does not corrupt the file).
     */
    setActive(fid: string | null): void;
    /**
     * Removes a feature from `features[]`.
     *
     * Returns `true` when something was removed. Also clears
     * `session.active_feature_id` when it pointed at the removed id.
     */
    removeFeature(fid: string): boolean;
    /** Returns ids of all features whose status is `in_progress`. */
    featuresInProgress(): string[];
    /**
     * Records the most recent slash-command invocation and stamps
     * `session.started_at` on the very first call.
     */
    setLastCommand(command: string): void;
    /**
     * Returns the in-memory goals array, normalizing missing or
     * malformed entries on a legacy state.yaml. Mutations on the
     * returned array are visible on the next {@link State.save}.
     */
    goals(): GoalRuntimeState[];
    /** Returns the goal record for `gid`, or `null`. */
    getGoal(gid: string): GoalRuntimeState | null;
    /**
     * Returns the goal record for `gid`, inserting a `planning`
     * placeholder when the id is new.
     *
     * Identity is preserved across calls — mutations on the returned
     * object are visible on the next {@link State.save}.
     */
    ensureGoal(gid: string): GoalRuntimeState;
    /**
     * Sets `goal.status` for `gid`, updating `started_at` and
     * `completed_at` lifecycle timestamps when the transition warrants.
     *
     * Throws on unknown status. Resetting to an earlier phase is
     * allowed but does not clear timestamps.
     */
    setGoalStatus(gid: string, status: GoalStatus): void;
    /**
     * Sets `session.active_goal_id`.
     *
     * BR-015 (g) — sequential constraint. The previous goal stays
     * recorded under `goals[]` but is no longer the driver target.
     */
    setActiveGoal(gid: string | null): void;
    /** Returns `session.active_goal_id` (defaults to `null`). */
    activeGoalId(): string | null;
    /**
     * Updates the cached per-feature status for a goal.
     *
     * Used by drive loop iterations to keep the progress renderer
     * snapshot current without re-walking `state.features[]` on every
     * render. Out-of-band updates (work.py setStatus on a feature
     * inside a goal) are reconciled on the next drive iteration.
     */
    setGoalFeatureProgress(gid: string, fid: string, status: FeatureStatus): void;
    /** Removes a goal from `goals[]`. Also clears active_goal_id when matching. */
    removeGoal(gid: string): boolean;
    /** Returns a `{status: count}` map for each FEATURE_STATUSES entry. */
    featureCounts(): Record<FeatureStatus, number>;
    /**
     * Returns a deep-cloned snapshot of the in-memory state.
     *
     * Used by `/harness:status --json` and parity tests that want to
     * compare two states without aliasing concerns.
     */
    snapshot(): StateData;
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
export declare function isDeclaredEvidence(ev: unknown): boolean;
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
export declare function countDeclaredEvidence(feature: unknown, options?: CountDeclaredEvidenceOptions): number;
//# sourceMappingURL=state.d.ts.map