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