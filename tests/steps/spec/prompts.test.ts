// F-008 prompts — One-Question-at-a-Time 진행 상태

import { describe, expect, it } from 'vitest';
import { planMode } from '../../../src/steps/spec/modes.js';
import {
  applyAnswer,
  isDone,
  materialize,
  nextPrompt,
  startProgress,
} from '../../../src/steps/spec/prompts.js';

describe('prompts — 진행 흐름', () => {
  it('Mode B 에서 startProgress → nextPrompt 는 첫 prompt 를 반환한다', () => {
    const plan = planMode({ current: {}, mode: 'B' });
    const p0 = startProgress(plan);
    const q = nextPrompt(p0);
    expect(q).toBeDefined();
    expect(q?.path).toBe('project.name');
    expect(isDone(p0)).toBe(false);
  });

  it('applyAnswer 를 모든 prompt 에 대해 반복하면 isDone 이 true 가 된다', () => {
    const plan = planMode({ current: {}, mode: 'R' });
    let p = startProgress(plan);
    while (!isDone(p)) {
      p = applyAnswer(p, '답');
    }
    expect(isDone(p)).toBe(true);
    expect(nextPrompt(p)).toBeUndefined();
  });

  it('빈 답 + default 있는 prompt (Mode R) → default 채택', () => {
    // Refine 에서 default 를 갖는 prompt 는 없지만 (SPEC_FIELDS 의 자유 텍스트
    // 필드들은 autoDefault 가 없음), 합성 plan 으로 직접 검증한다.
    const plan = {
      autofills: {},
      prompts: [
        {
          path: 'project.summary',
          question: '?',
          kind: 'string' as const,
          default: '제안-기본값',
        },
      ],
    };
    const p0 = startProgress(plan);
    const p1 = applyAnswer(p0, '');
    expect(p1.answers['project.summary']).toBe('제안-기본값');
  });

  it('빈 답 + default 없음 → skip (answers 에 반영 안 됨)', () => {
    const plan = planMode({ current: {}, mode: 'E' });
    const p0 = startProgress(plan);
    const p1 = applyAnswer(p0, '');
    expect(Object.keys(p1.answers)).toHaveLength(0);
    expect(p1.cursor).toBe(1);
  });

  it('완료된 progress 에 답 적용 → throw', () => {
    const plan = { autofills: {}, prompts: [] };
    const p0 = startProgress(plan);
    expect(() => applyAnswer(p0, 'x')).toThrow(/종료된/);
  });
});

describe('materialize — autofills + answers 병합', () => {
  it('Mode A: autofills 만으로 spec 을 채운다', () => {
    const plan = planMode({ current: {}, mode: 'A' });
    const p = startProgress(plan);
    const out = materialize({}, p);
    expect(out).toMatchObject({
      project: { version: '0.1.0' },
      constraints: {
        tech_stack: {
          language: 'TypeScript 5',
          runtime: 'Node.js 20+ (ESM)',
        },
        architecture: { pattern: 'layered' },
      },
    });
  });

  it('Mode B: 사용자 답이 그대로 반영되며 기존 값은 보존된다', () => {
    const start = {
      project: { name: 'existing' }, // 이미 있음 → Mode B 는 질문하지 않음
    };
    const plan = planMode({ current: start, mode: 'B' });
    let p = startProgress(plan);
    while (!isDone(p)) {
      const q = nextPrompt(p);
      if (!q) break;
      p = applyAnswer(p, `답-${q.path}`);
    }
    const out = materialize(start as Record<string, unknown>, p);
    // 기존 값은 그대로.
    expect((out as { project: { name: string } }).project.name).toBe('existing');
    // 답이 나머지 필드에 반영.
    expect((out as { project: { version: string } }).project.version).toBe(
      '답-project.version',
    );
  });

  it('Mode E: autofills 비어 있고 skip(빈 답) 은 기존 값을 건드리지 않는다', () => {
    const start = { project: { name: 'keep' } };
    const plan = planMode({ current: start, mode: 'E' });
    let p = startProgress(plan);
    while (!isDone(p)) {
      p = applyAnswer(p, ''); // 모두 skip
    }
    const out = materialize(start as Record<string, unknown>, p);
    expect(out).toEqual({ project: { name: 'keep' } });
  });
});
