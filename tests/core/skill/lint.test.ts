import { describe, expect, it } from 'vitest';

import { hasErrors, lintSkillMd } from '../../../src/core/skill/lint.js';
import type { SkillLintRuleId } from '../../../src/core/skill/types.js';

const mkBody = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `paragraph ${i + 1}`).join('\n');

const wrap = (body: string, name = 'demo', description = 'ok') =>
  ['---', `name: ${name}`, `description: ${description}`, '---', body].join('\n');

const rulesOf = (report: ReturnType<typeof lintSkillMd>): SkillLintRuleId[] =>
  report.violations.map((v) => v.rule);

describe('lintSkillMd — BR-006 state verification', () => {
  it('valid short skill has no violations', () => {
    const src = wrap('# Overview\n\nShort content.');

    const report = lintSkillMd(src);

    expect(report.violations).toEqual([]);
    expect(hasErrors(report)).toBe(false);
  });

  it('flags skill/line-count when body exceeds 500 lines', () => {
    const src = wrap(mkBody(501));

    const report = lintSkillMd(src);

    expect(rulesOf(report)).toContain('skill/line-count');
    expect(hasErrors(report)).toBe(true);
  });

  it('does not flag line-count at exactly 500 lines', () => {
    const src = wrap(mkBody(500));

    const report = lintSkillMd(src);

    expect(rulesOf(report)).not.toContain('skill/line-count');
  });

  it('respects maxBodyLines override', () => {
    const src = wrap(mkBody(100));

    const report = lintSkillMd(src, { maxBodyLines: 50 });

    expect(rulesOf(report)).toContain('skill/line-count');
  });

  it('flags skill/frontmatter-required when frontmatter is missing entirely', () => {
    const src = '# no frontmatter\n\nbody';

    const report = lintSkillMd(src);

    expect(rulesOf(report)).toContain('skill/frontmatter-required');
  });

  it('flags skill/frontmatter-required when name is missing', () => {
    const src = ['---', 'description: d', '---', '# body'].join('\n');

    const report = lintSkillMd(src);

    const msgs = report.violations
      .filter((v) => v.rule === 'skill/frontmatter-required')
      .map((v) => v.message);
    expect(msgs.some((m) => m.includes('name'))).toBe(true);
  });

  it('flags skill/frontmatter-required when description is missing', () => {
    const src = ['---', 'name: n', '---', '# body'].join('\n');

    const report = lintSkillMd(src);

    const msgs = report.violations
      .filter((v) => v.rule === 'skill/frontmatter-required')
      .map((v) => v.message);
    expect(msgs.some((m) => m.includes('description'))).toBe(true);
  });

  it('flags skill/rationalization-location for each anti-rationalization section in body', () => {
    const src = wrap(
      [
        '# Overview',
        '## Rationalization',
        'why...',
        '## Red Flags',
        'warnings...',
        '## Verification',
        'checks...',
      ].join('\n'),
    );

    const report = lintSkillMd(src);

    const violations = report.violations.filter(
      (v) => v.rule === 'skill/rationalization-location',
    );
    expect(violations).toHaveLength(3);
    expect(violations.every((v) => typeof v.line === 'number')).toBe(true);
  });

  it('does not flag anti-rationalization when the headings are absent', () => {
    const src = wrap('# Overview\n## Usage\n## Examples\n');

    const report = lintSkillMd(src);

    expect(rulesOf(report)).not.toContain('skill/rationalization-location');
  });

  it('ignores rationalization headings that appear inside fenced code blocks', () => {
    const src = wrap(
      [
        '# Overview',
        '',
        '```md',
        '## Rationalization',
        '```',
      ].join('\n'),
    );

    const report = lintSkillMd(src);

    expect(rulesOf(report)).not.toContain('skill/rationalization-location');
  });
});

describe('lintSkillMd — Anthropic skill compatibility (AC3)', () => {
  // AC3: 10 개 이상 Anthropic 공식 스킬 호환 검사 통과.  실제 스킬 저장소는
  // gitignored 이므로, 실제 스킬에서 관찰된 frontmatter · 헤딩 형태를 재현한
  // 10 개 fixture 로 재현 가능한 회귀를 건다.  각 fixture 에 대해 린터가 ①
  // 예외 없이 실행되고 ② frontmatter 를 인식하는 것이 기준 — Anthropic 은
  // 자체 정책으로 500 라인을 넘길 수 있어 line-count 실패는 허용된다.

  const anthropicLikeSkills = [
    { name: 'docx', body: mkBody(590) },
    { name: 'pptx', body: mkBody(320) },
    { name: 'pdf', body: mkBody(314) },
    { name: 'xlsx', body: mkBody(210) },
    { name: 'brand-guidelines', body: mkBody(73) },
    { name: 'canvas-design', body: mkBody(129) },
    { name: 'frontend-design', body: mkBody(42) },
    { name: 'internal-comms', body: mkBody(32) },
    { name: 'mcp-builder', body: mkBody(236) },
    { name: 'skill-creator', body: mkBody(180) },
  ];

  it.each(anthropicLikeSkills)(
    'parses Anthropic-shape skill "$name" without throwing',
    ({ name, body }) => {
      const src = [
        '---',
        `name: ${name}`,
        `description: "Use this skill when ... ${name}"`,
        '---',
        `# ${name}`,
        '',
        body,
      ].join('\n');

      const report = lintSkillMd(src);

      expect(report.parsed.frontmatter?.name).toBe(name);
      expect(report.parsed.frontmatter?.description).toContain(name);
      // 호환 검사 — anti-rationalization / frontmatter 규칙 위반은 없어야 한다.
      // line-count 는 정책적 초과가 허용된다.
      const structural = report.violations.filter(
        (v) => v.rule !== 'skill/line-count',
      );
      expect(structural).toEqual([]);
    },
  );
});
