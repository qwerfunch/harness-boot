// harness-boot — Skill Layout 린터 타입 (F-005, BR-006)
//
// BR-006: SKILL.md 본문 ≤ 500 라인, Anti-Rationalization 3-섹션
// (Rationalization / Red Flags / Verification) 은 `references/rationalization.md`
// 에만 둔다.  린터는 이 두 불변식을 정적으로 검증한다 (state-verification).

export type SkillLintSeverity = 'error' | 'warn';

export type SkillLintRuleId =
  | 'skill/line-count'
  | 'skill/frontmatter-required'
  | 'skill/rationalization-location';

export interface SkillLintViolation {
  readonly rule: SkillLintRuleId;
  readonly severity: SkillLintSeverity;
  readonly message: string;
  readonly line?: number;
}

export interface SkillFrontmatter {
  readonly name?: string;
  readonly description?: string;
  readonly raw: Record<string, string>;
}

export interface ParsedSkill {
  readonly frontmatter?: SkillFrontmatter;
  readonly body: string;
  readonly lineCount: number;
  readonly headings: readonly SkillHeading[];
}

export interface SkillHeading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

export interface SkillLintReport {
  readonly violations: readonly SkillLintViolation[];
  readonly parsed: ParsedSkill;
}

export interface SkillLintOptions {
  readonly maxBodyLines?: number;
}

export const DEFAULT_MAX_BODY_LINES = 500;

export const ANTI_RATIONALIZATION_HEADINGS: readonly string[] = [
  'Rationalization',
  'Red Flags',
  'Verification',
];
