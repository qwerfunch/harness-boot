// F-008 planMode — Mode A/B/R/E Given/When/Then

import { describe, expect, it } from 'vitest';
import { planMode } from '../../../src/steps/spec/modes.js';

describe('planMode — Mode A (Auto)', () => {
  it('Given 빈 spec When Mode A Then autoDefault 를 가진 모든 필드가 자동 채워지고 질문은 없다', () => {
    const plan = planMode({ current: {}, mode: 'A' });

    expect(plan.prompts).toEqual([]);
    // autoDefault 가 있는 6 개 필드 (version · language · runtime · framework · testing · pattern).
    expect(plan.autofills['project.version']).toBe('0.1.0');
    expect(plan.autofills['constraints.tech_stack.language']).toBe('TypeScript 5');
    expect(plan.autofills['constraints.tech_stack.runtime']).toBe('Node.js 20+ (ESM)');
    expect(plan.autofills['constraints.tech_stack.framework']).toBe(
      'Claude Code Plugin API v1',
    );
    expect(plan.autofills['constraints.tech_stack.testing']).toBe('Vitest 2');
    expect(plan.autofills['constraints.architecture.pattern']).toBe('layered');
    // project.name · summary · description · domain.overview 는 autoDefault 없음 → 누락.
    expect(plan.autofills['project.name']).toBeUndefined();
    expect(plan.autofills['project.summary']).toBeUndefined();
  });

  it('Given 이미 값이 있는 필드 When Mode A Then 그 필드는 자동 채움 대상에서 빠진다', () => {
    const plan = planMode({
      current: { project: { version: '9.9.9' } },
      mode: 'A',
    });
    expect(plan.autofills['project.version']).toBeUndefined();
    // 다른 autoDefault 필드는 여전히 채움.
    expect(plan.autofills['constraints.tech_stack.language']).toBe('TypeScript 5');
  });
});

describe('planMode — Mode B (Blank)', () => {
  it('Given 빈 spec When Mode B Then 모든 필드가 제안 없이 질문된다', () => {
    const plan = planMode({ current: {}, mode: 'B' });
    expect(plan.autofills).toEqual({});
    // 10 개 필드 모두 prompt 화.
    expect(plan.prompts).toHaveLength(10);
    for (const p of plan.prompts) {
      expect(p.default).toBeUndefined();
    }
  });

  it('Given 이미 값이 있는 필드 When Mode B Then 해당 필드는 질문되지 않는다', () => {
    const plan = planMode({
      current: {
        project: { name: 'my-proj', version: '1.0.0', summary: 'test' },
      },
      mode: 'B',
    });
    const paths = plan.prompts.map((p) => p.path);
    expect(paths).not.toContain('project.name');
    expect(paths).not.toContain('project.version');
    expect(paths).not.toContain('project.summary');
    expect(paths).toContain('project.description');
  });
});

describe('planMode — Mode R (Refine)', () => {
  it('Given 빈 spec When Mode R Then 자유 텍스트 필드만 autoDefault 제안과 함께 질문된다', () => {
    const plan = planMode({ current: {}, mode: 'R' });
    expect(plan.autofills).toEqual({});
    const paths = plan.prompts.map((p) => p.path);
    // 자유 텍스트 3 개: summary · description · domain.overview
    expect(paths).toEqual(['project.summary', 'project.description', 'domain.overview']);
  });

  it('Given 자유 텍스트 중 일부만 채워진 spec When Mode R Then 비어 있는 것만 질문된다', () => {
    const plan = planMode({
      current: { project: { summary: '이미 있음' } },
      mode: 'R',
    });
    const paths = plan.prompts.map((p) => p.path);
    expect(paths).not.toContain('project.summary');
    expect(paths).toContain('project.description');
    expect(paths).toContain('domain.overview');
  });

  it('Given 구조 필드만 비어 있는 spec When Mode R Then 해당 필드들은 질문 대상이 아니다', () => {
    const plan = planMode({
      current: {
        project: {
          summary: '있음',
          description: '있음',
        },
        domain: { overview: '있음' },
      },
      mode: 'R',
    });
    // 자유 텍스트가 모두 채워졌으니 prompt 없어야 함.
    expect(plan.prompts).toEqual([]);
  });
});

describe('planMode — Mode E (Expert)', () => {
  it('Given 빈 spec When Mode E Then 모든 필드가 제안 없이 질문된다', () => {
    const plan = planMode({ current: {}, mode: 'E' });
    expect(plan.autofills).toEqual({});
    expect(plan.prompts).toHaveLength(10);
    for (const p of plan.prompts) {
      expect(p.default).toBeUndefined();
    }
  });

  it('Given 값이 있는 필드 When Mode E Then 기존 값은 건드리지 않고 질문 대상에서도 제외 (BR-001)', () => {
    const plan = planMode({
      current: {
        project: { name: 'keep', version: '2.0.0' },
        constraints: { tech_stack: { language: 'Rust' } },
      },
      mode: 'E',
    });
    // 자동 채움 없음 — 기존 값을 덮어쓰지 않는다.
    expect(plan.autofills).toEqual({});
    const paths = plan.prompts.map((p) => p.path);
    expect(paths).not.toContain('project.name');
    expect(paths).not.toContain('project.version');
    expect(paths).not.toContain('constraints.tech_stack.language');
  });
});

describe('planMode — One Question at a Time 설계 원칙 호환', () => {
  it('반환된 prompts 는 순서가 결정적이다 (동일 입력 → 동일 순서)', () => {
    const p1 = planMode({ current: {}, mode: 'B' });
    const p2 = planMode({ current: {}, mode: 'B' });
    expect(p1.prompts.map((p) => p.path)).toEqual(p2.prompts.map((p) => p.path));
  });
});
