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

import {stringify as yamlStringify} from 'yaml';

import {stampDraftLabel, type DraftLabelResult, type SpecConfidence} from './draftLabel.js';

/** Allowed values for `metadata.quality_focus`. */
export type QualityFocus = 'design' | 'performance' | 'accessibility' | 'security';

/** Allowed values for `project.mode`. */
export type ProjectMode = 'prototype' | 'product';

/** Allowed deliverable types (subset of v2.3.8 schema). */
export type DeliverableType =
  | 'cli'
  | 'web-service'
  | 'game'
  | 'worker'
  | 'library'
  | 'static-site'
  | 'desktop'
  | 'mobile-app';

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

const SKELETON_FEATURE_ID = 'F-0';

function slugifyFeatureId(index: number): string {
  // F-1, F-2, ... — leave F-0 for the skeleton sentinel.
  return `F-${index}`;
}

function escapeYamlScalar(value: string): string {
  // Defer escaping to yaml.stringify by passing structures, not raw strings;
  // this helper exists only to keep the public surface readable.
  return value;
}

function pickConfidence(input: ScenarioIdeaInput): SpecConfidence {
  if (
    input.name.length > 0 &&
    input.vision.length > 0 &&
    input.features.length >= 3
  ) {
    return 'medium';
  }
  return 'low';
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
export function generateIdeaSpec(input: ScenarioIdeaInput): ScenarioIdeaResult {
  const deliverable = input.deliverableType ?? 'cli';
  const confidence = pickConfidence(input);
  const features = buildFeatures(input.features);
  const spec = {
    version: '2.3',
    project: {
      name: input.name,
      summary: input.vision,
      description: '',
      vision: input.vision,
      mode: input.mode,
      stakeholders: [] as string[],
    },
    domain: {
      entities: [] as unknown[],
      business_rules: [] as unknown[],
    },
    constraints: {
      tech_stack: {},
    },
    deliverable: {
      type: deliverable,
      entry_points: [] as unknown[],
      smoke_scenarios: ['walking skeleton: program boots without crashing'],
    },
    features,
    metadata: {
      source: {
        origin: 'idea',
        maturity: 'planning',
        revision: 'v0.1',
      },
      quality_focus: [...input.qualityFocus],
    },
  };

  // Manually serialize once to feed the stamp helper, which then
  // attaches metadata.draft + content_hash deterministically.
  const initialYaml = yamlStringify(spec, {sortMapEntries: true});
  const stamped: DraftLabelResult = stampDraftLabel({
    specYaml: initialYaml,
    origin: 'idea',
    confidence,
  });

  return {
    specYaml: stamped.specYaml,
    contentHash: stamped.contentHash,
    confidence,
  };
}

interface FeatureEntry {
  readonly id: string;
  readonly type: 'skeleton' | 'feature';
  readonly title: string;
  readonly priority: 'P0' | 'P1' | 'P2';
  readonly test_strategy: 'lean-tdd' | 'tdd' | 'smoke';
  readonly acceptance_criteria: ReadonlyArray<string>;
  readonly modules: ReadonlyArray<string>;
}

function buildFeatures(names: ReadonlyArray<string>): ReadonlyArray<FeatureEntry> {
  const skeleton: FeatureEntry = {
    id: SKELETON_FEATURE_ID,
    type: 'skeleton',
    title: 'Walking skeleton — program boots',
    priority: 'P0',
    test_strategy: 'lean-tdd',
    acceptance_criteria: [],
    modules: [],
  };
  const userFeatures: FeatureEntry[] = names.map((name, idx) => ({
    id: slugifyFeatureId(idx + 1),
    type: 'feature',
    title: escapeYamlScalar(name),
    priority: idx === 0 ? 'P0' : 'P1',
    test_strategy: 'lean-tdd',
    acceptance_criteria: [],
    modules: [],
  }));
  return [skeleton, ...userFeatures];
}

