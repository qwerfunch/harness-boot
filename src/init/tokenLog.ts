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

import {appendFileSync} from 'node:fs';

/** One LLM-call accounting event. */
export interface LlmCallEvent {
  /** ISO-8601 UTC timestamp without milliseconds. */
  readonly ts: string;
  /** Always `'llm_call'`. */
  readonly type: 'llm_call';
  /** Init scenario the call belongs to. */
  readonly scenario: 'idea' | 'plan_doc' | 'existing_code';
  /** Agent that made the call (e.g. `'researcher'`, `'product-planner'`). */
  readonly agent: string;
  /** Input tokens consumed. */
  readonly tokens_in: number;
  /** Output tokens generated. */
  readonly tokens_out: number;
  /** Optional model identifier. */
  readonly model?: string;
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

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Append a single `llm_call` event to `events.log`. Fail-open by
 * design — token accounting must never block init.
 */
export function recordLlmCall(input: RecordLlmCallInput): void {
  const line: LlmCallEvent = {
    ts: input.now ?? nowIso(),
    type: 'llm_call',
    scenario: input.event.scenario,
    agent: input.event.agent,
    tokens_in: input.event.tokens_in,
    tokens_out: input.event.tokens_out,
  };
  const payload: Record<string, unknown> = {...line};
  if (input.event.model !== undefined) payload['model'] = input.event.model;
  try {
    appendFileSync(input.eventsPath, JSON.stringify(payload) + '\n', 'utf8');
  } catch {
    // intentional silent — token accounting is fail-open
  }
}
