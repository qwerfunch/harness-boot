/**
 * Scenario-2 (plan_doc → spec) deterministic seeder (F-162).
 *
 * Reads a markdown plan document, redacts any credential-shaped
 * strings, and stamps a partial draft `spec.yaml` body: project
 * name from the first H1 (or filename fallback), summary from the
 * first paragraph, description from the first 500 characters.
 *
 * The slash command's `spec-conversion` skill picks up from here
 * in a follow-up LLM turn to fill `features[]`, `entities`, and
 * the rest of v2.3.8.
 *
 * @module init/scenarioPlanDoc
 */
/** Result of {@link seedSpecFromPlanDoc}. */
export interface SeedPlanDocResult {
    /** The rewritten spec.yaml body. */
    readonly specYaml: string;
    /** Project name derived from the H1 or filename. */
    readonly projectName: string;
    /** First paragraph of the plan doc (already redacted). */
    readonly summary: string;
    /** Path stamped into `metadata.source.plan_doc_path` (relative when possible). */
    readonly planDocPath: string;
    /** SHA-256 content hash matching the rewritten body. */
    readonly contentHash: string;
}
/** Required input for {@link seedSpecFromPlanDoc}. */
export interface SeedPlanDocInput {
    /** Path to the markdown plan document. */
    readonly mdPath: string;
    /** Path to the existing spec.yaml (rewritten in place). */
    readonly specPath: string;
    /** Project root used to compute the relative plan_doc_path. */
    readonly projectRoot: string;
}
/**
 * Read the plan doc, redact, and rewrite spec.yaml with the seeded
 * metadata + project fields. Returns enough detail for the CLI to
 * report what happened.
 */
export declare function seedSpecFromPlanDoc(input: SeedPlanDocInput): SeedPlanDocResult;
//# sourceMappingURL=scenarioPlanDoc.d.ts.map