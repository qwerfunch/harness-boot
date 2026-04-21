// harness-boot — SKILL.md 린터 (F-005, BR-006)
//
// 규칙 3 개:
//   R1 skill/line-count             — 본문 > 500 라인 → error
//   R2 skill/frontmatter-required   — name / description 없음 → error
//   R3 skill/rationalization-location
//      — Rationalization / Red Flags / Verification 헤딩이 SKILL.md 본문에
//        존재 → error (references/rationalization.md 로 이동해야 함)

import { findAntiRationalizationHeadings, parseSkillMd } from './parser.js';
import {
  DEFAULT_MAX_BODY_LINES,
  type SkillLintOptions,
  type SkillLintReport,
  type SkillLintViolation,
} from './types.js';

export function lintSkillMd(
  source: string,
  options: SkillLintOptions = {},
): SkillLintReport {
  const parsed = parseSkillMd(source);
  const violations: SkillLintViolation[] = [];
  const maxLines = options.maxBodyLines ?? DEFAULT_MAX_BODY_LINES;

  if (parsed.lineCount > maxLines) {
    violations.push({
      rule: 'skill/line-count',
      severity: 'error',
      message: `SKILL.md 본문이 ${parsed.lineCount} 라인으로 상한 ${maxLines} 를 초과한다 (BR-006).`,
    });
  }

  if (!parsed.frontmatter) {
    violations.push({
      rule: 'skill/frontmatter-required',
      severity: 'error',
      message: 'SKILL.md 는 YAML 프런트매터(--- 로 감싼 name·description) 가 필요하다.',
    });
  } else {
    if (!parsed.frontmatter.name) {
      violations.push({
        rule: 'skill/frontmatter-required',
        severity: 'error',
        message: '프런트매터에 name 키가 없다.',
      });
    }
    if (!parsed.frontmatter.description) {
      violations.push({
        rule: 'skill/frontmatter-required',
        severity: 'error',
        message: '프런트매터에 description 키가 없다.',
      });
    }
  }

  const antiRat = findAntiRationalizationHeadings(parsed.headings);
  for (const heading of antiRat) {
    violations.push({
      rule: 'skill/rationalization-location',
      severity: 'error',
      message: `"${heading.text}" 섹션은 SKILL.md 본문이 아니라 references/rationalization.md 에 있어야 한다 (BR-006).`,
      line: heading.line,
    });
  }

  return { violations, parsed };
}

export function hasErrors(report: SkillLintReport): boolean {
  return report.violations.some((v) => v.severity === 'error');
}
