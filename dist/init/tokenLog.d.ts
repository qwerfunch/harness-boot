/**
 * `events.log` helper for LLM-call accounting (F-159 infra).
 *
 * Scenario 1 itself doesn't call any model from the CLI side — the
 * slash command does that and is expected to record its own tokens
 * via this helper. Scenarios 2/3 (later PRs) will call models from
 * `harness:codebase-archaeologist` and `skills/spec-conversion` and
 * record token usage the same way.
 *
 * The bench under `tests/perf/initBench.test.ts` reads back the
 * sum of `tokens_in + tokens_out` across `llm_call` events to
 * compute `init_tokens_total` for the regression gate.
 *
 * @module init/tokenLog
 */
/**
 * Scenario tag identifying which surface drove the LLM call.
 *
 * - `idea` / `plan_doc` / `existing_code` — init scenarios (F-159+).
 * - `work` — F-172. General `harness work` cycle (subagent invocations,
 *   manual self-report, hook-driven auto-capture).
 */
export type LlmCallScenario = 'idea' | 'plan_doc' | 'existing_code' | 'work';
/** One LLM-call accounting event. */
export interface LlmCallEvent {
    /** ISO-8601 UTC timestamp without milliseconds. */
    readonly ts: string;
    /** Always `'llm_call'`. */
    readonly type: 'llm_call';
    /** Surface tag. */
    readonly scenario: LlmCallScenario;
    /** Agent that made the call (e.g. `'researcher'`, `'product-planner'`). */
    readonly agent: string;
    /** Input tokens consumed. */
    readonly tokens_in: number;
    /** Output tokens generated. */
    readonly tokens_out: number;
    /** Optional model identifier. */
    readonly model?: string;
    /** F-172 — optional feature id when the call belongs to a work cycle. */
    readonly feature?: string;
}
/** Required input for {@link recordLlmCall}. */
export interface RecordLlmCallInput {
    /** Path to `.harness/events.log`. */
    readonly eventsPath: string;
    /** Event payload (minus `ts` + `type`, which are fixed here). */
    readonly event: Omit<LlmCallEvent, 'ts' | 'type'>;
    /** Optional ISO-8601 timestamp; defaults to now. */
    readonly now?: string;
}
/**
 * Append a single `llm_call` event to `events.log`. Fail-open by
 * design — token accounting must never block init.
 */
export declare function recordLlmCall(input: RecordLlmCallInput): void;
//# sourceMappingURL=tokenLog.d.ts.map