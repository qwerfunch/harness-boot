/**
 * User-facing string catalog with EN / KO translations (F-092 port
 * of `scripts/ui/messages.py`, originally F-040).
 *
 * Backend stays English (deterministic core, code, schema, commit
 * messages). This catalog covers only the surface a user reads — the
 * "frontend" of the plugin. Adding a key:
 *
 *   1. Append the key to {@link REQUIRED_KEYS}.
 *   2. Add the entry to both `EN` and `KO` dicts.
 *   3. Bump the parity test so a missing translation fails loudly.
 *
 * @module ui/messages
 */
const EN = {
    status: 'status',
    passed: 'passed',
    failed: 'failed',
    evidence: 'evidence: {n} entries',
    routed_agents: 'routed agents',
    agent_chain: 'agent chain',
    in_progress: 'in progress',
    done: 'done',
    planned: 'planned',
    blocked: 'blocked',
    archived: 'archived',
    gate_pass: 'gate {name}: pass',
    gate_fail: 'gate {name}: fail',
    iron_law_block: 'cannot complete yet — {declared}/{required} evidence entries declared. Add more with --evidence.',
    walking_skeleton: 'walking skeleton',
    active_feature: 'working on: "{title}"',
    progress_line: '  progress: {passed}/{total} gates passed · {evidence} evidence entries',
    blocker_line: '  blocker: {note}',
    dashboard_title: 'harness-boot',
    no_active: 'no active feature.',
    all_done: 'all features complete — {n} done.',
    next_actions: 'next actions:',
    enter_hint: 'Enter = {n} (recommended)',
    init_starting: 'scaffolding .harness/ ...',
    init_done: 'scaffolding complete.',
    in_progress_others: 'in progress (others):',
    pending_label: 'pending:',
    on_hold_label: 'on hold:',
    next_candidates: 'next candidates (spec-defined · not started, {n}):',
    more_after_truncate: '  … and {n} more (see spec.yaml)',
    no_features: 'no features yet.',
    no_active_no_pending: 'nothing in progress or pending.',
    recommended_marker: '(recommended)',
};
const KO = {
    status: '상태',
    passed: '통과',
    failed: '실패',
    evidence: '근거: {n} 개',
    routed_agents: '라우팅된 팀',
    agent_chain: '에이전트 체인',
    in_progress: '진행 중',
    done: '완료',
    planned: '예정',
    blocked: '차단',
    archived: '보관',
    gate_pass: '검증 {name}: 통과',
    gate_fail: '검증 {name}: 실패',
    iron_law_block: '아직 완료할 수 없어요 — 근거가 {declared}/{required} 개입니다. --evidence 로 더 추가하세요.',
    walking_skeleton: '기본 골격',
    active_feature: '작업 중: "{title}"',
    progress_line: '  진행: 검증 {passed}/{total} 통과 · 근거 {evidence} 개',
    blocker_line: '  차단: {note}',
    dashboard_title: 'harness-boot',
    no_active: '현재 작업 중인 피처 없음.',
    all_done: '모든 피처 완료 — 완료 {n} 개.',
    next_actions: '다음 할 일:',
    enter_hint: 'Enter = {n} (추천)',
    init_starting: '.harness/ 골격 생성 중 ...',
    init_done: '골격 생성 완료.',
    in_progress_others: '진행 중 (다른):',
    pending_label: '대기:',
    on_hold_label: '보류:',
    next_candidates: '다음 후보 (spec 정의 · 미시작, {n} 개):',
    more_after_truncate: '  … 외 {n} 개 (spec.yaml 참조)',
    no_features: '아직 피처가 없습니다.',
    no_active_no_pending: '진행 중 · 대기 피처 없음.',
    recommended_marker: '(추천)',
};
const CATALOGS = { en: EN, ko: KO };
/** Every required catalog key — translation parity is asserted on this list. */
export const REQUIRED_KEYS = Object.keys(EN);
/**
 * Resolves a catalog entry for a given locale, with EN fallback.
 *
 * @param key - Catalog key. Throws when unknown — missing
 *   translations should fail loud rather than ship blank text.
 * @param lang - Locale tag; unknown values fall back to `'en'`.
 * @param fmt - Positional formatter values for `{name}`-style
 *   placeholders.
 */
export function t(key, lang = 'en', fmt = {}) {
    let catalog = CATALOGS[lang] ?? EN;
    if (!(key in catalog)) {
        if (!(key in EN)) {
            throw new Error(`unknown message key: '${key}'`);
        }
        catalog = EN;
    }
    let template = catalog[key];
    if (Object.keys(fmt).length === 0) {
        return template;
    }
    for (const [k, v] of Object.entries(fmt)) {
        template = template.split(`{${k}}`).join(String(v));
    }
    return template;
}
//# sourceMappingURL=messages.js.map