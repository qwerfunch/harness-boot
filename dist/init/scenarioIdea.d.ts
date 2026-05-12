/**
 * Scenario-1 (idea → spec) deterministic transform (F-159).
 *
 * The slash command collects four answers from the user via the
 * `harness:researcher` agent (a single LLM turn). This module turns
 * those answers into a draft `spec.yaml` body — pure, no LLM call.
 *
 * That separation keeps the parity test trivial (no fixtures of
 * model output) while still letting the slash command iterate on
 * the prompt shape.
 *
 * @module init/scenarioIdea
 */
import { type SpecConfidence } from './draftLabel.js';
/** Allowed values for `metadata.quality_focus`. */
export type QualityFocus = 'design' | 'performance' | 'accessibility' | 'security';
/** Allowed values for `project.mode`. */
export type ProjectMode = 'prototype' | 'product';
/** Allowed deliverable types (subset of v2.3.8 schema). */
export type DeliverableType = 'cli' | 'web-service' | 'game' | 'worker' | 'library' | 'static-site' | 'desktop' | 'mobile-app';
/** Input collected from the researcher ticky-taka. */
export interface ScenarioIdeaInput {
    /** Project name (kebab-case recommended). */
    readonly name: string;
    /** One-line vision — what the product does. */
    readonly vision: string;
    /** Feature names (3–5 recommended). */
    readonly features: ReadonlyArray<string>;
    /** Project mode. */
    readonly mode: ProjectMode;
    /** Quality-focus markers; downstream work-cycle routing weighs these. */
    readonly qualityFocus: ReadonlyArray<QualityFocus>;
    /** Deliverable type (defaults to `cli`). */
    readonly deliverableType?: DeliverableType;
}
/** Output of {@link generateIdeaSpec}. */
export interface ScenarioIdeaResult {
    /** The serialized spec.yaml string. */
    readonly specYaml: string;
    /** SHA-256 of the spec body (stamped by `draftLabel`). */
    readonly contentHash: string;
    /** Confidence heuristic — `medium` when name + vision + ≥ 3 features, `low` otherwise. */
    readonly confidence: SpecConfidence;
}
/**
 * Build a draft spec.yaml from the four ticky-taka answers.
 *
 * The output validates against `docs/schemas/spec.schema.json`
 * (v2.3.8): mandatory `project.name`, `project.summary`,
 * `deliverable.type`, `deliverable.entry_points`,
 * `deliverable.smoke_scenarios`, and a skeleton `features[0]` entry.
 *
 * Quality-focus markers ride on `metadata.quality_focus` (a
 * scenario-1 addition); they do not bind any schema-required field
 * but the work-cycle router consults them when picking the
 * downstream agent chain.
 */
export declare function generateIdeaSpec(input: ScenarioIdeaInput): ScenarioIdeaResult;
//# sourceMappingURL=scenarioIdea.d.ts.map