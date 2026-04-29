/**
 * `/harness:spec` mode classifier — A/B/R/E auto-routing (F-090 port
 * of `scripts/spec/mode_classifier.py`, F-002 in spec).
 *
 * Determinism:
 *
 *   - Same inputs → same {@link Mode} every time.
 *   - F-002 acceptance criteria depend on this property; never wire
 *     external state, randomness, or wall-clock checks here.
 *
 * Priority order (matches `commands/spec.md`):
 *
 *   1. Explicit `--mode X` (any value not in A/B/R/E throws).
 *   2. `--explain` flag or explain-shaped intent.
 *   3. spec missing + `.md` argument → Mode B (subtype baseline-from-plan).
 *   4. spec missing + sparse intent (1–39 words) → Mode B (subtype
 *      baseline-empty-vague).
 *   5. spec missing + everything else → Mode B (subtype baseline-empty).
 *   6. spec exists + addition-shaped intent → Mode A.
 *   7. spec exists + everything else → Mode R (default refine).
 *
 * @module spec/modeClassifier
 */
/** The four routing modes the slash command can dispatch into. */
export declare const Mode: {
    readonly ADDITION: "A";
    readonly BASELINE: "B";
    readonly REFINE: "R";
    readonly EXPLAIN: "E";
};
/** Type-level alias for {@link Mode} values. */
export type Mode = (typeof Mode)[keyof typeof Mode];
/** Result of one classification call. */
export interface ClassifyResult {
    mode: Mode;
    rationale: string;
    /** Optional fine-grained branch identifier (e.g. `'baseline-empty-vague'`). */
    subtype: string;
    args: ReadonlyArray<string>;
}
/** Optional input shape for {@link classify}. */
export interface ClassifyOptions {
    args?: ReadonlyArray<string>;
    specExists?: boolean;
    intentText?: string;
}
/**
 * Returns the mode + rationale for a given slash-command invocation.
 *
 * @throws when `--mode <value>` carries something other than A/B/R/E.
 */
export declare function classify(options?: ClassifyOptions): ClassifyResult;
//# sourceMappingURL=modeClassifier.d.ts.map