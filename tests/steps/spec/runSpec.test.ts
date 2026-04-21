// F-008 runSpec — Mode A/B/R/E 통합 시나리오 (AC1~AC5)

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runSpec } from '../../../src/steps/spec/index.js';
import type { AskFn } from '../../../src/steps/spec/index.js';
import type { SpecPrompt } from '../../../src/steps/spec/types.js';

function askerFromMap(map: Record<string, string>): AskFn {
  return async (prompt: SpecPrompt) => map[prompt.path] ?? '';
}

function askerForbidden(): AskFn {
  return async () => {
    throw new Error('Mode A 는 질문을 해서는 안 된다');
  };
}

describe('runSpec — AC1 Mode A: 빈 spec 자동 채움 · 질문 없음', () => {
  it('빈 source 를 Mode A 로 돌리면 구조 필드가 자동 채워지고 ask 는 호출되지 않는다', async () => {
    const result = await runSpec({
      source: '',
      mode: 'A',
      ask: askerForbidden(),
    });
    expect(result.promptsAsked).toBe(0);
    expect(result.autofills['constraints.tech_stack.language']).toBe('TypeScript 5');
    const parsed = parseYaml(result.yaml) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      project: { version: '0.1.0' },
      constraints: {
        tech_stack: { framework: 'Claude Code Plugin API v1' },
        architecture: { pattern: 'layered' },
      },
    });
  });
});

describe('runSpec — AC2 Mode R: 자유 텍스트 필드에만 제안', () => {
  it('부분 채워진 spec 을 Mode R 로 돌리면 summary/description/overview 만 질문된다', async () => {
    const asked: string[] = [];
    const ask: AskFn = async (p) => {
      asked.push(p.path);
      return '생성된-답';
    };
    const source = [
      'project:',
      '  name: existing',
      '  version: 1.0.0',
      'constraints:',
      '  tech_stack:',
      '    language: Rust',
      '',
    ].join('\n');
    const result = await runSpec({ source, mode: 'R', ask });
    expect(asked).toEqual([
      'project.summary',
      'project.description',
      'domain.overview',
    ]);
    // 기존 값은 보존.
    const parsed = parseYaml(result.yaml) as {
      project: { name: string; version: string; summary: string };
      constraints: { tech_stack: { language: string } };
    };
    expect(parsed.project.name).toBe('existing');
    expect(parsed.project.version).toBe('1.0.0');
    expect(parsed.constraints.tech_stack.language).toBe('Rust');
    expect(parsed.project.summary).toBe('생성된-답');
  });
});

describe('runSpec — AC3 Mode B: 빈 필드만 질문, 기존 값 보존', () => {
  it('일부 필드가 채워진 spec 을 Mode B 로 돌리면 그 필드는 건너뛴다', async () => {
    const asked: string[] = [];
    const ask: AskFn = async (p) => {
      asked.push(p.path);
      return `v-${p.path}`;
    };
    const source = 'project:\n  name: fixed\n';
    const result = await runSpec({ source, mode: 'B', ask });
    expect(asked).not.toContain('project.name');
    // 나머지 9 필드 질문.
    expect(asked).toHaveLength(9);
    const parsed = parseYaml(result.yaml) as {
      project: { name: string; version: string };
    };
    expect(parsed.project.name).toBe('fixed');
    expect(parsed.project.version).toBe('v-project.version');
  });
});

describe('runSpec — AC4 Mode E: 기존 값 절대 임의 수정 금지 (BR-001)', () => {
  it('값이 있는 필드는 질문도 받지 않고 자동 채움도 하지 않는다', async () => {
    const source = [
      'project:',
      '  name: my-proj',
      '  version: 9.9.9',
      '  summary: 고정',
      '  description: 고정',
      'domain:',
      '  overview: 고정',
      'constraints:',
      '  tech_stack:',
      '    language: Rust',
      '    runtime: wasm',
      '    framework: custom',
      '    testing: custom',
      '  architecture:',
      '    pattern: hexagonal',
      '',
    ].join('\n');
    const ask: AskFn = askerForbidden();
    const result = await runSpec({ source, mode: 'E', ask });
    expect(result.promptsAsked).toBe(0);
    expect(result.autofills).toEqual({});
    const parsed = parseYaml(result.yaml) as {
      project: { version: string };
      constraints: { architecture: { pattern: string } };
    };
    expect(parsed.project.version).toBe('9.9.9');
    expect(parsed.constraints.architecture.pattern).toBe('hexagonal');
  });
});

describe('runSpec — AC5 One Question at a Time', () => {
  it('ask 는 prompt 당 정확히 한 번 호출되며, 호출 순서는 결정적이다', async () => {
    const callLog: Array<{ path: string; index: number }> = [];
    let index = 0;
    const ask: AskFn = async (p) => {
      callLog.push({ path: p.path, index: index++ });
      return 'x';
    };
    await runSpec({ source: '', mode: 'B', ask });
    // 첫 질문은 반드시 project.name — fields.ts 카탈로그의 첫 항목.
    expect(callLog[0]?.path).toBe('project.name');
    // 인덱스 연속.
    for (let i = 0; i < callLog.length; i += 1) {
      expect(callLog[i]?.index).toBe(i);
    }
  });
});
