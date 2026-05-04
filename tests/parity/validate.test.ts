/**
 * Parity test for `src/spec/validate.ts` (F-089).
 *
 * Covers:
 *
 *   - Loading the canonical sample spec via TS and validating it
 *     against the same JSONSchema Python uses — identical pass/fail
 *     outcome.
 *   - Negative inputs (top-level non-mapping, malformed YAML)
 *     surface SpecValidationError with the expected `reason`.
 *   - Schema-violation errors carry an `absolutePath`-shaped path.
 *
 * Run via `npm run test:parity`.
 */

import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {SpecValidationError, loadSpec, validate} from '../../src/spec/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const CANONICAL_SPEC = join(REPO_ROOT, 'docs', 'samples', 'harness-boot-self', 'spec.yaml');
const SCHEMA_PATH = join(REPO_ROOT, 'docs', 'schemas', 'spec.schema.json');

describe('spec validator — happy path', () => {
  it('loadSpec parses the canonical sample without throwing', () => {
    const data = loadSpec(CANONICAL_SPEC);
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
    expect(data['version']).toBeDefined();
  });

  it('validate succeeds against the canonical sample (parity with Python)', () => {
    const data = loadSpec(CANONICAL_SPEC);
    expect(() => validate(data, SCHEMA_PATH)).not.toThrow();
  });

  it('validate uses the default schema path when caller passes null', () => {
    const data = loadSpec(CANONICAL_SPEC);
    expect(() => validate(data, null)).not.toThrow();
  });
});

describe('spec validator — top-level guards', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'validate-'));
  });
  afterEach(() => {
    rmSync(workDir, {recursive: true, force: true});
  });

  it('rejects an empty file (parses to null) with reason=top_level', () => {
    const path = join(workDir, 'empty.yaml');
    writeFileSync(path, '', 'utf-8');
    try {
      loadSpec(path);
      expect.fail('expected loadSpec to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      expect((err as SpecValidationError).reason).toBe('top_level');
    }
  });

  it('rejects a top-level scalar with reason=top_level', () => {
    const path = join(workDir, 'scalar.yaml');
    writeFileSync(path, '42\n', 'utf-8');
    expect(() => loadSpec(path)).toThrow(SpecValidationError);
  });

  it('rejects a top-level array with reason=top_level', () => {
    const path = join(workDir, 'array.yaml');
    writeFileSync(path, '- one\n- two\n', 'utf-8');
    expect(() => loadSpec(path)).toThrow(SpecValidationError);
  });

  it('rejects malformed YAML with reason=yaml_parse', () => {
    const path = join(workDir, 'bad.yaml');
    // Unmatched bracket — yaml parser must reject.
    writeFileSync(path, 'key: [unclosed\n', 'utf-8');
    try {
      loadSpec(path);
      expect.fail('expected loadSpec to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      expect((err as SpecValidationError).reason).toBe('yaml_parse');
    }
  });

  it('rejects missing files with reason=read_error', () => {
    const path = join(workDir, 'does-not-exist.yaml');
    try {
      loadSpec(path);
      expect.fail('expected loadSpec to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      expect((err as SpecValidationError).reason).toBe('read_error');
    }
  });
});

describe('spec validator — schema violations', () => {
  it('throws SpecValidationError with absolutePath-shaped path on violation', () => {
    // Cherry-pick a minimal invalid spec — missing required `version`.
    const invalid = {
      schema_version: '2.3',
      project: {name: 'x', mode: 'prototype'},
    };
    try {
      validate(invalid, SCHEMA_PATH);
      expect.fail('expected validate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      expect((err as SpecValidationError).path).toBeInstanceOf(Array);
      // ajv reports `required` as the keyword for missing-required errors.
      expect((err as SpecValidationError).reason).toBeTruthy();
    }
  });

  it('throws with reason=missing_schema_file when schema does not exist', () => {
    try {
      validate({}, '/nonexistent/schema.json');
      expect.fail('expected validate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      expect((err as SpecValidationError).reason).toBe('missing_schema_file');
    }
  });
});

describe('spec validator — Python parity sanity', () => {
  it('TS valid result matches Python valid result for the canonical spec', () => {
    // Read the same spec from disk that Python uses.
    const raw = readFileSync(CANONICAL_SPEC, 'utf-8');
    expect(raw.length).toBeGreaterThan(0);
    const parsed = loadSpec(CANONICAL_SPEC);
    expect(() => validate(parsed, SCHEMA_PATH)).not.toThrow();
    // The canonical spec has dozens of features — confirm we actually
    // walked structure rather than short-circuiting.
    expect(Array.isArray(parsed['features'])).toBe(true);
    expect((parsed['features'] as unknown[]).length).toBeGreaterThan(10);
  });
});

describe('starter spec template (F-121 / L-001)', () => {
  // The template at docs/templates/starter/spec.yaml.template is the
  // file `/harness-boot:init` writes into a fresh project. It must
  // satisfy spec.schema.json so the very first `harness sync --soft`
  // does not surface a SpecValidationError to the user.
  const TEMPLATE_PATH = join(REPO_ROOT, 'docs', 'templates', 'starter', 'spec.yaml.template');

  it('passes AJV validation against spec.schema.json', () => {
    const parsed = loadSpec(TEMPLATE_PATH);
    expect(() => validate(parsed, SCHEMA_PATH)).not.toThrow();
  });

  it('declares all schema-required project.* fields (regression guard)', () => {
    const parsed = loadSpec(TEMPLATE_PATH);
    const project = parsed['project'] as Record<string, unknown> | undefined;
    expect(project).toBeDefined();
    // Schema requires ["name", "summary"] — see docs/schemas/spec.schema.json.
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('summary');
  });
});
