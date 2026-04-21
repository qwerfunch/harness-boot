import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Ajv2020Module from 'ajv/dist/2020.js';
import * as addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { parseSpecYaml } from '../../../src/core/spec/parse.js';

// ajv `2020` subpath 는 CJS 로 published — NodeNext + esModuleInterop 하에서
// 네임스페이스 import 후 `.default` 로 생성자를 꺼내 쓴다.
const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts?: object) => AjvLike })
  .default;
const addFormats = (
  addFormatsModule as unknown as { default: (ajv: AjvLike) => void }
).default;

interface AjvLike {
  compile(schema: object): ValidateFn;
}
interface ValidateFn {
  (data: unknown): boolean;
  errors?: { instancePath: string; message?: string }[] | null;
}

const SCHEMA_PATH = resolve(__dirname, '../../../schemas/spec.schema.json');
const SPEC_PATH = resolve(__dirname, '../../../spec.yaml');

function loadSchema(): unknown {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
}

// strict 를 끈다 — 사용자가 작성하는 spec.yaml 은 `additionalProperties` 를
// 명시하지 않아도 수용한다.  각 테스트는 깨끗한 AJV 인스턴스를 사용해 schema
// $id 캐시 충돌을 피한다.
function mkAjv(): AjvLike {
  const inst = new Ajv2020({ strict: false, allErrors: true });
  addFormats(inst);
  return inst;
}

describe('spec.schema.json — JSON Schema Draft 2020-12', () => {
  it('is a syntactically valid schema (AJV can compile it)', () => {
    const schema = loadSchema();
    expect(() => mkAjv().compile(schema as object)).not.toThrow();
  });

  it('declares Draft 2020-12 via $schema', () => {
    const schema = loadSchema() as { $schema?: string };
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});

describe('spec.schema.json — dogfood', () => {
  it('validates the real spec.yaml (AC5)', () => {
    const schema = loadSchema();
    const validate = mkAjv().compile(schema as object);
    const source = readFileSync(SPEC_PATH, 'utf8');
    const result = parseSpecYaml(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ok = validate(result.data);
    if (!ok) {
      const summary = (validate.errors ?? [])
        .slice(0, 10)
        .map((e: { instancePath: string; message?: string }) =>
          `${e.instancePath} ${e.message ?? ''}`,
        )
        .join('\n');
      throw new Error(`spec.yaml 이 스키마에 맞지 않다:\n${summary}`);
    }
    expect(ok).toBe(true);
  });

  it('rejects a spec missing required "features" key', () => {
    const schema = loadSchema();
    const validate = mkAjv().compile(schema as object);
    const bad = {
      version: '2.3.6',
      project: { name: 'x', version: '0.1.0' },
      domain: { overview: 'x' },
      constraints: {
        tech_stack: {
          language: 'TS',
          runtime: 'Node',
          framework: 'CC',
          testing: 'Vitest',
        },
        architecture: { pattern: 'layered' },
        quality: { coverage_threshold: 85, required_gates: [0] },
      },
      deliverable: { type: 'library' },
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects feature.id that does not match ^F-\\d{3,}$', () => {
    const schema = loadSchema();
    const validate = mkAjv().compile(schema as object);
    const bad = {
      version: '2.3.6',
      project: { name: 'x', version: '0.1.0' },
      domain: { overview: 'x' },
      constraints: {
        tech_stack: {
          language: 'TS',
          runtime: 'Node',
          framework: 'CC',
          testing: 'Vitest',
        },
        architecture: { pattern: 'layered' },
        quality: { coverage_threshold: 85, required_gates: [0] },
      },
      deliverable: { type: 'library' },
      features: [
        {
          id: 'bad-id',
          type: 'skeleton',
          title: 't',
          priority: 1,
          status: 'planned',
          test_strategy: 'tdd',
          acceptance_criteria: ['x'],
        },
      ],
    };
    expect(validate(bad)).toBe(false);
  });
});
