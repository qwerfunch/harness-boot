/**
 * Spec exporter — emits a compacted copy of `spec.yaml` for context-
 * conscious LLM imports (F-131, logcat-on ISSUES-LOG return).
 *
 * Why this module exists:
 *
 * Projects that have accumulated 200+ done features now spend tens of
 * thousands of tokens on every Claude conversation just on the
 * `acceptance_criteria` and `description` bodies of features that have
 * already shipped — `@.harness/spec.yaml` is a whole-file import.
 * This module produces a derived view where done / archived features
 * are summarised down to one placeholder line per AC array and a
 * truncated description, while active features (planned, in_progress,
 * blocked, or absent from state.yaml entirely) are emitted byte-
 * identical to the input.
 *
 * Boundaries:
 *
 *   - **Read-only.** Never mutates `spec.yaml` or `state.yaml`; CQS
 *     (BR-012) is enforced by the CLI integration test.
 *   - **Schema-preserving.** The placeholder is still a string inside
 *     `acceptance_criteria: string[]`, so the output passes
 *     `spec.schema.json` (verified by AC-7).
 *   - **Lite scope.** Compaction logic for the two heaviest free-text
 *     fields only. Structured fields (modules, ui_surface,
 *     performance_budget, etc.) pass through unchanged.
 *
 * @module spec/exportSpec
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
/** Maximum length of the compacted `description` first line. */
export const DESCRIPTION_TRUNCATE_AT = 120;
/** Statuses considered "shipped" — eligible for compaction. */
const SHIPPED_STATUSES = new Set(['done', 'archived']);
/**
 * Reads `<harnessDir>/spec.yaml` (and `<harnessDir>/state.yaml` when
 * `activeOnly` is true) and returns the resulting yaml document as a
 * string. The default behaviour (no flags) is an idempotent yaml
 * round-trip — useful for normalisation, no-op for the caller. With
 * `activeOnly`, every feature in a shipped state has its
 * `acceptance_criteria` and `description` compacted.
 *
 * @param harnessDir absolute or relative path to the `.harness/` dir
 * @param options    see {@link ExportSpecOptions}
 * @returns the stringified yaml document, ending with a newline
 * @throws Error when spec.yaml is missing or malformed
 */
export function exportSpec(harnessDir, options = {}) {
    const specPath = join(harnessDir, 'spec.yaml');
    const specText = readFileSync(specPath, 'utf-8');
    const spec = yamlParse(specText);
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error(`spec.yaml at ${specPath} did not parse to a mapping`);
    }
    if (!options.activeOnly) {
        return yamlStringify(spec);
    }
    const shippedIds = readShippedIds(harnessDir);
    const features = spec['features'];
    if (Array.isArray(features)) {
        spec['features'] = features.map((entry) => compactFeature(entry, shippedIds));
    }
    return yamlStringify(spec);
}
/**
 * Reads `state.yaml` and returns the set of feature IDs whose status
 * is in {@link SHIPPED_STATUSES}. Returns an empty set when the file
 * is missing — that means every feature is treated as active, which
 * matches the unshipped-fresh-spec case.
 */
function readShippedIds(harnessDir) {
    const statePath = join(harnessDir, 'state.yaml');
    let raw;
    try {
        raw = readFileSync(statePath, 'utf-8');
    }
    catch {
        return new Set();
    }
    const state = yamlParse(raw);
    if (state === null || typeof state !== 'object' || Array.isArray(state)) {
        return new Set();
    }
    const features = state['features'];
    if (!Array.isArray(features)) {
        return new Set();
    }
    const out = new Set();
    for (const f of features) {
        if (f === null || typeof f !== 'object' || Array.isArray(f)) {
            continue;
        }
        const record = f;
        const id = record['id'];
        const status = record['status'];
        if (typeof id === 'string' && typeof status === 'string' && SHIPPED_STATUSES.has(status)) {
            out.add(id);
        }
    }
    return out;
}
/**
 * Returns a compacted clone of the feature entry when its id is in
 * the shipped set; otherwise returns the original entry unchanged.
 * Cloning is shallow at the entry level + targeted at the two heavy
 * fields, so the rest of the structure (modules, ui_surface,
 * performance_budget, …) passes through by reference.
 */
function compactFeature(entry, shippedIds) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        return entry;
    }
    const record = entry;
    const id = record['id'];
    if (typeof id !== 'string' || !shippedIds.has(id)) {
        return entry;
    }
    const compacted = { ...record };
    const ac = record['acceptance_criteria'];
    if (Array.isArray(ac)) {
        compacted['acceptance_criteria'] = [`(${ac.length} criteria — see spec.yaml history)`];
    }
    const description = record['description'];
    if (typeof description === 'string' && description.length > 0) {
        compacted['description'] = compactDescription(description);
    }
    return compacted;
}
/**
 * Picks the first non-blank line of a multi-line description and
 * hard-truncates it. Trailing punctuation is preserved up to the cap;
 * if truncation occurs the result ends with `…`. Empty input returns
 * the empty string so the caller can choose whether to keep the field.
 */
export function compactDescription(text) {
    const firstLine = text
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (firstLine === undefined) {
        return '';
    }
    if (firstLine.length <= DESCRIPTION_TRUNCATE_AT) {
        return firstLine;
    }
    return `${firstLine.slice(0, DESCRIPTION_TRUNCATE_AT)}…`;
}
//# sourceMappingURL=exportSpec.js.map