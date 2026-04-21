// harness-boot — SKILL.md 파서 (F-005)
//
// 프런트매터(YAML)·본문·헤딩을 분리한다.  외부 YAML 라이브러리에 의존하지
// 않으며, Anthropic 공식 스킬이 쓰는 단순 `key: value` · `key: "quoted value"`
// 형태만 지원한다.  복잡한 중첩 YAML 이 필요하면 js-yaml 로 교체한다.

import {
  ANTI_RATIONALIZATION_HEADINGS,
  type ParsedSkill,
  type SkillFrontmatter,
  type SkillHeading,
} from './types.js';

const FRONTMATTER_FENCE = '---';

export function parseSkillMd(source: string): ParsedSkill {
  const lines = splitLines(source);
  const { frontmatter, bodyStartLine } = extractFrontmatter(lines);
  const bodyLines = lines.slice(bodyStartLine);
  const headings = extractHeadings(bodyLines, bodyStartLine);

  return {
    ...(frontmatter !== undefined ? { frontmatter } : {}),
    body: bodyLines.join('\n'),
    lineCount: bodyLines.length,
    headings,
  };
}

export function findAntiRationalizationHeadings(
  headings: readonly SkillHeading[],
): SkillHeading[] {
  const targets = new Set(ANTI_RATIONALIZATION_HEADINGS.map((h) => h.toLowerCase()));
  return headings.filter((h) => targets.has(h.text.toLowerCase()));
}

function extractFrontmatter(lines: readonly string[]): {
  frontmatter: SkillFrontmatter | undefined;
  bodyStartLine: number;
} {
  if (lines[0] !== FRONTMATTER_FENCE) {
    return { frontmatter: undefined, bodyStartLine: 0 };
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FRONTMATTER_FENCE) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { frontmatter: undefined, bodyStartLine: 0 };
  }

  const raw: Record<string, string> = {};
  for (let i = 1; i < closeIdx; i++) {
    const line = lines[i] as string;
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, valueRaw] = match;
    raw[key as string] = unquote((valueRaw ?? '').trim());
  }

  const fm: SkillFrontmatter = {
    raw,
    ...(raw['name'] !== undefined ? { name: raw['name'] } : {}),
    ...(raw['description'] !== undefined
      ? { description: raw['description'] }
      : {}),
  };

  return { frontmatter: fm, bodyStartLine: closeIdx + 1 };
}

function extractHeadings(
  bodyLines: readonly string[],
  bodyStartLine: number,
): SkillHeading[] {
  const headings: SkillHeading[] = [];
  let inFence = false;
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i] as string;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const [, hashes, text] = match;
    headings.push({
      level: (hashes as string).length,
      text: (text as string).trim(),
      line: bodyStartLine + i + 1,
    });
  }
  return headings;
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function splitLines(source: string): string[] {
  return source.split(/\r?\n/);
}
