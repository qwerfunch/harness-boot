/**
 * Spec validator — JSONSchema validation for `spec.yaml` (F-089 port
 * of `scripts/spec/validate.py`).
 *
 * Loads the canonical schema from `docs/schemas/spec.schema.json`
 * (resolved off the package root) and runs ajv against a parsed spec
 * object. The Python source uses the optional `jsonschema` library;
 * the TS port standardises on ajv 8 with `ajv-formats` for the
 * date-time / uri / email format keywords.
 *
 * Exposed surface:
 *
 *   - {@link loadSpec} — read a YAML file, return the parsed object,
 *     throw {@link SpecValidationError} on malformed YAML or non-
 *     mapping top level.
 *   - {@link validate} — run ajv against the schema, throw
 *     {@link SpecValidationError} with the same path + reason fields
 *     the Python implementation raises.
 *   - {@link SpecValidationError} — typed error carrying `path` +
 *     `reason` for machine-readable diagnostics.
 *
 * @module spec/validate
 */
/**
 * Thrown when a spec fails validation.
 *
 * `path` mirrors Python's `e.absolute_path` — a list of property
 * names and array indices identifying the offending node.
 * `reason` mirrors Python's `e.validator` (e.g. `'required'`,
 * `'pattern'`, `'enum'`, plus the bespoke `'top_level'`,
 * `'missing_schema_file'` markers raised by this module).
 */
export declare class SpecValidationError extends Error {
    readonly path: Array<string | number>;
    readonly reason: string;
    constructor(message: string, path?: Array<string | number>, reason?: string);
}
/**
 * Reads a YAML spec file and returns the parsed object.
 *
 * @throws {@link SpecValidationError} when the YAML cannot be parsed
 *   or when the top-level node is not a mapping (matches Python's
 *   `top_level` reason).
 */
export declare function loadSpec(specPath: string): Record<string, unknown>;
/**
 * Soft-warning entry surfaced by {@link collectWarnings}.
 *
 * Distinct from {@link SpecValidationError} — warnings never throw and
 * never gate sync / complete. They exist to nudge authors toward
 * healthier patterns (e.g. F-166 title length).
 */
export interface SpecWarning {
    /** Stable identifier — e.g. `feature.name_too_long`. */
    code: string;
    /** JSON-pointer-like path to the offending node. */
    path: Array<string | number>;
    /** Human-readable advice. */
    message: string;
}
/**
 * Collects non-blocking lint warnings from a parsed spec.
 *
 * Each warning is purely advisory — callers (CLI, sync, work) decide
 * whether to print, ignore, or aggregate. The function never throws
 * and always returns an array, even on malformed input.
 *
 * Current checks:
 *
 *   - **F-166** `feature.name_too_long`: emitted when a feature's
 *     `name` length (Unicode code points) exceeds
 *     {@link FEATURE_NAME_MAX_LENGTH}. The message suggests moving
 *     overflow content into `digest:` or `description:` so the
 *     dashboard and `git log --oneline` stay readable.
 */
export declare function collectWarnings(spec: unknown): SpecWarning[];
/**
 * Validates a parsed spec against the JSONSchema.
 *
 * @param spec - Parsed `spec.yaml` object (as produced by
 *   {@link loadSpec}).
 * @param schemaPath - Override path to a JSONSchema file. Defaults
 *   to `<repo>/docs/schemas/spec.schema.json`.
 * @throws {@link SpecValidationError} when the spec violates the
 *   schema or when the schema file is missing.
 */
export declare function validate(spec: unknown, schemaPath?: string | null): void;
//# sourceMappingURL=validate.d.ts.map