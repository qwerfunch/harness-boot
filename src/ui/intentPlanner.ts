/**
 * Deterministic "next actions" recommender (F-099 port of
 * `scripts/ui/intent_planner.py`, v0.9.2).
 *
 * Pure: no I/O, no state mutation, no LLM call. Reads a `state.yaml`
 * object and an optional `spec.yaml`; returns an ordered list of
 * {@link Suggestion} for the dashboard / `/harness-boot:work`
 * router to render.
 *
 * Active-feature priority (first match wins):
 *
 *   1. `blocked` status or recent `blocker` evidence → resolve_block.
 *   2. Any gate with `last_result == 'fail'` → analyze + rerun.
 *   3. Earliest standard gate not yet pass → run that gate.
 *   4. `gate_5` pass + zero evidence → add_evidence.
 *   5. `gate_5` pass + ≥ 1 evidence → complete.
 *   6. Fallback → deactivate.
 *
 * Idle path:
 *
 *   1. Some feature `in_progress` → resume.
 *   2. Some feature `planned` → start_feature.
 *   3. spec-only unregistered → start_feature.
 *   4. Otherwise → init_feature.
 *
 * @module ui/intentPlanner
 */

const STANDARD_GATES: ReadonlyArray<string> = [
  'gate_0',
  'gate_1',
  'gate_2',
  'gate_3',
  'gate_4',
  'gate_5',
];

/** Discrete machine-routable action identifier. */
export type Action =
  | 'resolve_block'
  | 'analyze_fail'
  | 'run_gate'
  | 'add_evidence'
  | 'complete'
  | 'deactivate'
  | 'resume'
  | 'start_feature'
  | 'init_feature'
  | 'review_carry_forward';

/** One proposed next action. */
export interface Suggestion {
  label: string;
  action: Action;
  feature_id?: string | null;
  gate?: string | null;
}

/** Optional input for {@link suggest}. */
export interface SuggestOptions {
  /** F-079 coverage ratio for the active feature, when known. */
  coverage?: number | null;
}

const DEFAULT_COVERAGE_THRESHOLD = 0.8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function featureTitle(fid: string, spec: unknown): string {
  if (!isPlainObject(spec)) {
    return fid;
  }
  for (const f of asArray(spec['features'])) {
    if (isPlainObject(f) && f['id'] === fid) {
      const title = (f['name'] as string | undefined) ?? (f['title'] as string | undefined);
      if (typeof title === 'string' && title.trim().length > 0) {
        return title.trim();
      }
    }
  }
  return fid;
}

/**
 * Returns true when the most recent evidence entry is a blocker
 * (look at the last entry only — once the user logs post-block
 * evidence the suggestion flips back to the normal flow).
 */
function hasRecentBlocker(evidence: unknown): boolean {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return false;
  }
  const last = evidence[evidence.length - 1];
  return isPlainObject(last) && last['kind'] === 'blocker';
}

function suggestionsForActive(feature: Record<string, unknown>, spec: unknown): Suggestion[] {
  const fid = typeof feature['id'] === 'string' ? feature['id'] : '?';
  const status = typeof feature['status'] === 'string' ? feature['status'] : 'planned';
  const gates = isPlainObject(feature['gates']) ? (feature['gates'] as Record<string, unknown>) : {};
  const evidence = asArray(feature['evidence']);
  const title = featureTitle(fid, spec);

  // 1. Blocked.
  if (status === 'blocked' || hasRecentBlocker(evidence)) {
    return [
      {label: `차단 해결 시도: "${title}"`, action: 'resolve_block', feature_id: fid},
      {label: '다른 작업으로 전환', action: 'deactivate'},
    ];
  }

  // 2. Gate fail.
  const failed: string[] = [];
  for (const [name, g] of Object.entries(gates)) {
    if (isPlainObject(g) && g['last_result'] === 'fail') {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    const ordered = STANDARD_GATES.filter((g) => failed.includes(g));
    const first = ordered.length > 0 ? ordered[0]! : [...failed].sort()[0]!;
    return [
      {label: `실패 원인 분석: ${first}`, action: 'analyze_fail', feature_id: fid, gate: first},
      {label: `${first} 재실행`, action: 'run_gate', feature_id: fid, gate: first},
      {label: '다른 작업으로 전환', action: 'deactivate'},
    ];
  }

  // 3. Earliest not-yet-pass gate.
  let nextGate: string | null = null;
  for (const gateName of STANDARD_GATES) {
    const g = gates[gateName];
    const result = isPlainObject(g) ? g['last_result'] : null;
    if (result !== 'pass') {
      nextGate = gateName;
      break;
    }
  }

  const gate5 = gates['gate_5'];
  const gate5Pass = isPlainObject(gate5) && gate5['last_result'] === 'pass';

  // 4-5. All gates pass — pick add_evidence vs complete.
  if (gate5Pass && nextGate === null) {
    if (evidence.length === 0) {
      return [
        {label: `근거 1 건 추가 ("${title}")`, action: 'add_evidence', feature_id: fid},
        {label: '다른 작업으로 전환', action: 'deactivate'},
      ];
    }
    return [
      {label: `완료 처리: "${title}"`, action: 'complete', feature_id: fid},
      {label: '다른 작업으로 전환', action: 'deactivate'},
    ];
  }

  if (nextGate !== null) {
    return [
      {label: `검증 실행: ${nextGate}`, action: 'run_gate', feature_id: fid, gate: nextGate},
      {label: '다른 작업으로 전환', action: 'deactivate'},
    ];
  }

  return [{label: '다른 작업으로 전환', action: 'deactivate'}];
}

/**
 * Returns the first spec-defined feature that is not yet registered
 * in `state.yaml.features`. Skips archived and superseded entries.
 */
function firstUnregisteredInSpec(features: ReadonlyArray<unknown>, spec: unknown): string | null {
  if (!isPlainObject(spec)) {
    return null;
  }
  const specFeatures = asArray(spec['features']);
  if (specFeatures.length === 0) {
    return null;
  }

  const registered = new Set<string>();
  for (const f of features) {
    if (isPlainObject(f) && typeof f['id'] === 'string') {
      registered.add(f['id']);
    }
  }
  for (const f of specFeatures) {
    if (!isPlainObject(f)) {
      continue;
    }
    const fid = f['id'];
    if (typeof fid !== 'string' || fid.length === 0) {
      continue;
    }
    if (registered.has(fid)) {
      continue;
    }
    if (f['status'] === 'archived') {
      continue;
    }
    if (f['superseded_by']) {
      continue;
    }
    return fid;
  }
  return null;
}

function suggestionsForIdle(features: ReadonlyArray<unknown>, spec: unknown): Suggestion[] {
  const inProgress = features.filter(
    (f): f is Record<string, unknown> =>
      isPlainObject(f) && f['status'] === 'in_progress' && typeof f['id'] === 'string',
  );
  const planned = features.filter(
    (f): f is Record<string, unknown> =>
      isPlainObject(f) && f['status'] === 'planned' && typeof f['id'] === 'string',
  );

  const out: Suggestion[] = [];

  if (inProgress.length > 0) {
    const fid = inProgress[0]!['id'] as string;
    out.push({
      label: `이어서 작업: "${featureTitle(fid, spec)}"`,
      action: 'resume',
      feature_id: fid,
    });
  }

  if (planned.length > 0) {
    const fid = planned[0]!['id'] as string;
    out.push({
      label: `다음 피처 시작: "${featureTitle(fid, spec)}"`,
      action: 'start_feature',
      feature_id: fid,
    });
  } else {
    const unregisteredFid = firstUnregisteredInSpec(features, spec);
    if (unregisteredFid !== null) {
      out.push({
        label: `다음 피처 시작: "${featureTitle(unregisteredFid, spec)}"`,
        action: 'start_feature',
        feature_id: unregisteredFid,
      });
    }
  }

  if (out.length === 0) {
    out.push({label: '새 피처 등록 (spec.yaml 편집)', action: 'init_feature'});
  }

  return out;
}

/**
 * Returns up to three suggestions ordered by recommendation strength.
 *
 * The first item is the recommended default — Enter chooses index 1
 * in the dashboard.
 *
 * @param stateData - Parsed `state.yaml` object.
 * @param spec - Optional parsed `spec.yaml` for title lookup.
 * @param options.coverage - F-079 coverage ratio; below 0.80
 *   prepends a `review_carry_forward` suggestion.
 */
export function suggest(
  stateData: unknown,
  spec: unknown = null,
  options: SuggestOptions = {},
): Suggestion[] {
  if (!isPlainObject(stateData)) {
    return [];
  }

  const session = isPlainObject(stateData['session']) ? (stateData['session'] as Record<string, unknown>) : {};
  const activeId = session['active_feature_id'];
  const features = asArray(stateData['features']);

  const byId = new Map<string, Record<string, unknown>>();
  for (const f of features) {
    if (isPlainObject(f) && typeof f['id'] === 'string') {
      byId.set(f['id'], f);
    }
  }

  let out: Suggestion[];
  if (typeof activeId === 'string' && byId.has(activeId)) {
    out = suggestionsForActive(byId.get(activeId)!, spec);
  } else {
    out = suggestionsForIdle(features, spec);
  }

  const coverage = options.coverage;
  if (coverage !== undefined && coverage !== null && coverage < DEFAULT_COVERAGE_THRESHOLD) {
    const pct = Math.round(coverage * 100);
    const thresholdPct = Math.round(DEFAULT_COVERAGE_THRESHOLD * 100);
    out = [
      {
        label:
          `Review carry-forward debt — coverage ${pct}% < threshold ${thresholdPct}% ` +
          '(explicit carry to retro before complete)',
        action: 'review_carry_forward',
      },
      ...out,
    ];
  }

  return out.slice(0, 3);
}
