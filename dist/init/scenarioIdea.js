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
import { stringify as yamlStringify } from 'yaml';
import { stampDraftLabel } from './draftLabel.js';
const SKELETON_FEATURE_ID = 'F-0';
function slugifyFeatureId(index) {
    // F-1, F-2, ... — leave F-0 for the skeleton sentinel.
    return `F-${index}`;
}
function escapeYamlScalar(value) {
    // Defer escaping to yaml.stringify by passing structures, not raw strings;
    // this helper exists only to keep the public surface readable.
    return value;
}
function pickConfidence(input) {
    if (input.name.length > 0 &&
        input.vision.length > 0 &&
        input.features.length >= 3) {
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
export function generateIdeaSpec(input) {
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
            stakeholders: [],
        },
        domain: {
            entities: [],
            business_rules: [],
        },
        constraints: {
            tech_stack: {},
        },
        deliverable: {
            type: deliverable,
            entry_points: [],
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
    const initialYaml = yamlStringify(spec, { sortMapEntries: true });
    const stamped = stampDraftLabel({
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
function buildFeatures(names) {
    const skeleton = {
        id: SKELETON_FEATURE_ID,
        type: 'skeleton',
        title: 'Walking skeleton — program boots',
        priority: 'P0',
        test_strategy: 'lean-tdd',
        acceptance_criteria: [],
        modules: [],
    };
    const userFeatures = names.map((name, idx) => ({
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
//# sourceMappingURL=scenarioIdea.js.map