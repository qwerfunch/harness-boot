/**
 * Design Review ceremony template generator (F-097 port of
 * `scripts/ceremonies/design_review.py`).
 *
 * When ux-architect saves `flows.md`, the orchestrator fires this to
 * scaffold `.harness/_workspace/design-review/F-N.md` — a template
 * with per-reviewer subheadings (visual-designer + frontend-engineer
 * + a11y-auditor, plus audio-designer when has_audio=true).
 *
 * @module ceremonies/designReview
 */
/**
 * Returns the reviewer ordering for a feature. When `hasAudio` is
 * true, audio-designer slots in immediately before a11y-auditor
 * (parallels kickoff ordering).
 */
export declare function reviewersFor(hasAudio: boolean): string[];
/** Optional input for {@link generateDesignReview}. */
export interface GenerateDesignReviewOptions {
    hasAudio?: boolean;
    timestamp?: string;
}
/**
 * Generates `.harness/_workspace/design-review/F-N.md` plus a
 * `design_review_opened` event. Returns the template path.
 */
export declare function generateDesignReview(harnessDir: string, featureId: string, options?: GenerateDesignReviewOptions): string;
/** True iff the design-review template for `featureId` already exists. */
export declare function designReviewExists(harnessDir: string, featureId: string): boolean;
//# sourceMappingURL=designReview.d.ts.map