/**
 * F-171 — init auto-routing.
 *
 * Picks an init scenario from the directory state, so `harness init`
 * with no flags does the obvious thing instead of erroring out.
 *
 * Decision tree (top to bottom — first match wins):
 *
 *   1. **plan_doc** — exactly one non-README markdown file at the
 *      project root. Strong signal: user already wrote intent down.
 *   2. **existing_code** — at least one tracked manifest
 *      (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`)
 *      OR a `src+tests` / `colocated` / `next-*` directory pattern.
 *      Strong signal: the harness is wrapping a real codebase.
 *   3. **skeleton-only** — fallback. Empty / sparse directory; user
 *      will fill the spec by hand or via the slash command.
 *
 * The user motive captured in F-171:
 *
 *   > 모든 것은 사용자가 요청하는 것이 아니라, 내부적으로 적시에
 *   > 자동 수행되어야 함.
 *
 * Manual `--scenario` / `--skeleton-only` flags still override; this
 * module only activates when the CLI was invoked without explicit
 * intent.
 *
 * @module init/autoDetect
 */
/** Result of {@link autoDetectScenario}. */
export type DetectedScenario = 'plan_doc' | 'existing_code' | 'skeleton-only';
/** Side-channel detail about how the scenario was chosen. */
export interface DetectedScenarioDetail {
    readonly scenario: DetectedScenario;
    /**
     * Free-form reason explaining the choice — shown to the user so
     * they understand why the auto-router landed here. Examples:
     *   - `plan_doc: SPEC.md`
     *   - `existing_code: package.json + src/`
     *   - `skeleton-only: no plan, no manifests`
     */
    readonly reason: string;
}
/**
 * Returns the recommended scenario for `projectRoot`. Always returns
 * something — never throws — so the CLI's no-flag path can rely on
 * this. The fallback is `skeleton-only`, which is the safest path
 * (writes the bare templates, zero LLM calls).
 */
export declare function autoDetectScenario(projectRoot: string): DetectedScenarioDetail;
//# sourceMappingURL=autoDetect.d.ts.map