/**
 * Render `.harness/conventions.md` from a Layer-0 {@link Signals}
 * record (F-160).
 *
 * Seven fixed sections — Stack · Style · Rules · Comments · Tests
 * · Imports · Directory — each line stamped with a
 * `<!-- harness:fact key=K value=V source=PATH -->` sigil so the
 * future Content-drift detector can spot stale values. The
 * `Comments` and `Tests` sections are LLM-fed and ship as
 * placeholders here (PR 3b fills them in).
 *
 * @module init/codebase/conventionsWriter
 */
import type { Signals } from './signals.js';
/** Result of {@link writeConventions}. */
export interface WriteConventionsResult {
    /** Absolute path the file was written to. */
    readonly path: string;
    /** Total number of `harness:fact` sigils embedded. */
    readonly factCount: number;
    /** The rendered body (also written to disk, returned for tests). */
    readonly body: string;
}
/**
 * Render the conventions body and write it to `targetPath`. The
 * body is also returned in the result for golden-file testing.
 */
export declare function writeConventions(signals: Signals, targetPath: string): WriteConventionsResult;
//# sourceMappingURL=conventionsWriter.d.ts.map