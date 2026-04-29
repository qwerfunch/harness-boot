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
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020Default from 'ajv/dist/2020.js';
import addFormatsDefault from 'ajv-formats';
import { parse as yamlParse } from 'yaml';
const Ajv2020Ctor = (Ajv2020Default.default ??
    Ajv2020Default);
const addFormats = (addFormatsDefault.default ??
    addFormatsDefault);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Thrown when a spec fails validation.
 *
 * `path` mirrors Python's `e.absolute_path` — a list of property
 * names and array indices identifying the offending node.
 * `reason` mirrors Python's `e.validator` (e.g. `'required'`,
 * `'pattern'`, `'enum'`, plus the bespoke `'top_level'`,
 * `'missing_schema_file'` markers raised by this module).
 */
export class SpecValidationError extends Error {
    path;
    reason;
    constructor(message, path = [], reason = '') {
        super(message);
        this.name = 'SpecValidationError';
        this.path = path;
        this.reason = reason;
    }
}
/**
 * Returns the default schema location — `<repoRoot>/docs/schemas/spec.schema.json`.
 *
 * The TS source lives at `src/spec/validate.ts` (post-build it lives
 * at `dist/spec/validate.js`). Walking three directories up from the
 * compiled file lands on the repo root in both source and build
 * layouts.
 */
function defaultSchemaPath() {
    // src/spec/validate.ts → dist/spec/validate.js → ../../.. lands at the
    // package root either way.
    const repoRoot = resolvePath(__dirname, '..', '..');
    return join(repoRoot, 'docs', 'schemas', 'spec.schema.json');
}
let ajvCache = null;
/** Builds (and caches) the ajv compiled validator for a given schema path. */
function getValidator(schemaPath) {
    const stat = statSync(schemaPath);
    const mtime = stat.mtimeMs;
    if (ajvCache !== null &&
        ajvCache.schemaPath === schemaPath &&
        ajvCache.schemaMtime === mtime) {
        return ajvCache.fn;
    }
    const schemaText = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaText);
    const ajv = new Ajv2020Ctor({ allErrors: false, strict: false });
    addFormats(ajv);
    const fn = ajv.compile(schema);
    ajvCache = { schemaPath, schemaMtime: mtime, fn };
    return fn;
}
/**
 * Reads a YAML spec file and returns the parsed object.
 *
 * @throws {@link SpecValidationError} when the YAML cannot be parsed
 *   or when the top-level node is not a mapping (matches Python's
 *   `top_level` reason).
 */
export function loadSpec(specPath) {
    let raw;
    try {
        raw = readFileSync(specPath, 'utf-8');
    }
    catch (err) {
        throw new SpecValidationError(`${specPath}: ${err.message}`, [], 'read_error');
    }
    let parsed;
    try {
        parsed = yamlParse(raw);
    }
    catch (err) {
        throw new SpecValidationError(`${specPath}: ${err.message}`, [], 'yaml_parse');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new SpecValidationError(`${specPath}: top-level YAML must be a mapping`, [], 'top_level');
    }
    return parsed;
}
/** Pretty-prints an ajv error path as a dotted string ("(root)" if empty). */
function formatPath(path) {
    if (path.length === 0) {
        return '(root)';
    }
    return path.map((p) => String(p)).join('.');
}
/**
 * Converts ajv's `ErrorObject.instancePath` to the Python-shaped
 * absolute-path list (segments split on `/`, integers parsed where
 * possible).
 */
function ajvErrorToPath(err) {
    if (!err.instancePath) {
        return [];
    }
    return err.instancePath
        .split('/')
        .filter((seg) => seg.length > 0)
        .map((seg) => {
        const decoded = seg.replace(/~1/g, '/').replace(/~0/g, '~');
        const asNum = Number(decoded);
        if (Number.isInteger(asNum) && String(asNum) === decoded) {
            return asNum;
        }
        return decoded;
    });
}
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
export function validate(spec, schemaPath = null) {
    const resolved = schemaPath ?? defaultSchemaPath();
    let isFile;
    try {
        isFile = statSync(resolved).isFile();
    }
    catch {
        isFile = false;
    }
    if (!isFile) {
        throw new SpecValidationError(`스키마 파일 없음: ${resolved}`, [], 'missing_schema_file');
    }
    const fn = getValidator(resolved);
    const ok = fn(spec);
    if (ok) {
        return;
    }
    const errors = fn.errors ?? [];
    if (errors.length === 0) {
        throw new SpecValidationError('schema validation failed (no error detail)', [], 'unknown');
    }
    const first = errors[0];
    const path = ajvErrorToPath(first);
    const pathStr = formatPath(path);
    throw new SpecValidationError(`${pathStr}: ${first.message ?? 'validation error'}`, path, first.keyword);
}
//# sourceMappingURL=validate.js.map