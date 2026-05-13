/**
 * F-171 — CLAUDE.md auto-copy helper.
 *
 * Used by every init scenario (skeleton-only · idea · existing_code ·
 * plan_doc) to land `CLAUDE.md` at the project root from
 * `docs/templates/starter/CLAUDE.md.template`. Strict skip-if-exists
 * semantics — once the user has a CLAUDE.md (custom edits or older
 * project context) the helper never overwrites it.
 *
 * The user motive captured in F-171:
 *
 *   > 모든 것은 사용자가 요청하는 것이 아니라, 내부적으로 적시에
 *   > 자동 수행되어야 함.
 *
 * Before F-171 the bare-skeleton path wrote three `.harness/` files
 * and no CLAUDE.md; users running the CLI directly got no Claude
 * Code context. Now every path installs the context file as a side
 * effect, so opening the project in Claude Code immediately picks
 * up `@.harness/spec.yaml` etc.
 *
 * @module init/claudeMd
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
/**
 * Copies the starter `CLAUDE.md.template` to `<targetDir>/CLAUDE.md`
 * **only when the target does not already exist**.
 *
 * Always returns; never throws. Callers that want to surface the
 * skip to the user can read `skippedReason` and emit a stderr line
 * (the helper itself stays quiet so it composes cleanly).
 */
export function copyClaudeMdIfAbsent(targetDir, pluginRoot) {
    const target = resolvePath(targetDir);
    const root = resolvePath(pluginRoot);
    const dest = join(target, 'CLAUDE.md');
    if (existsSync(dest)) {
        return { targetPath: dest, wrote: false, skippedReason: 'already_exists' };
    }
    const src = join(root, 'docs', 'templates', 'starter', 'CLAUDE.md.template');
    if (!existsSync(src)) {
        return { targetPath: dest, wrote: false, skippedReason: 'template_missing' };
    }
    const body = readFileSync(src, 'utf8');
    writeFileSync(dest, body, 'utf8');
    return { targetPath: dest, wrote: true, skippedReason: null };
}
//# sourceMappingURL=claudeMd.js.map