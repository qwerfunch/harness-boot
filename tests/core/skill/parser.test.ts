import { describe, expect, it } from 'vitest';

import {
  findAntiRationalizationHeadings,
  parseSkillMd,
} from '../../../src/core/skill/parser.js';

describe('parseSkillMd', () => {
  it('splits frontmatter and body, counts body lines (not frontmatter)', () => {
    const src = [
      '---',
      'name: demo',
      'description: "short desc"',
      '---',
      '# Title',
      '',
      'body line',
    ].join('\n');

    const parsed = parseSkillMd(src);

    expect(parsed.frontmatter?.name).toBe('demo');
    expect(parsed.frontmatter?.description).toBe('short desc');
    expect(parsed.lineCount).toBe(3);
    expect(parsed.headings.map((h) => h.text)).toEqual(['Title']);
    expect(parsed.headings[0]?.line).toBe(5);
  });

  it('treats missing frontmatter as no frontmatter, bodyStart at 0', () => {
    const src = '# No frontmatter\n\ncontent';

    const parsed = parseSkillMd(src);

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.lineCount).toBe(3);
    expect(parsed.headings[0]?.line).toBe(1);
  });

  it('tolerates unclosed frontmatter fence — no frontmatter, full body preserved', () => {
    const src = '---\nname: x\n\n# body';

    const parsed = parseSkillMd(src);

    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.lineCount).toBe(4);
  });

  it('ignores headings inside fenced code blocks', () => {
    const src = [
      '---',
      'name: x',
      'description: y',
      '---',
      '# Real Heading',
      '',
      '```markdown',
      '# Fake Heading In Code',
      '```',
      '## Second Real',
    ].join('\n');

    const parsed = parseSkillMd(src);

    expect(parsed.headings.map((h) => h.text)).toEqual([
      'Real Heading',
      'Second Real',
    ]);
  });

  it('supports single-quoted frontmatter values', () => {
    const src = [
      '---',
      "name: 'single-quoted'",
      "description: 'has : colon'",
      '---',
      '# Body',
    ].join('\n');

    const parsed = parseSkillMd(src);

    expect(parsed.frontmatter?.name).toBe('single-quoted');
    expect(parsed.frontmatter?.description).toBe('has : colon');
  });
});

describe('findAntiRationalizationHeadings', () => {
  it('finds Rationalization / Red Flags / Verification headings (case-insensitive)', () => {
    const src = [
      '---',
      'name: bad',
      'description: has anti-rat sections inline',
      '---',
      '# Intro',
      '## Rationalization',
      '',
      '## red flags',
      '',
      '## Verification',
    ].join('\n');

    const parsed = parseSkillMd(src);
    const found = findAntiRationalizationHeadings(parsed.headings);

    expect(found.map((h) => h.text)).toEqual([
      'Rationalization',
      'red flags',
      'Verification',
    ]);
  });

  it('returns empty when anti-rationalization headings are absent', () => {
    const src = '---\nname: x\ndescription: y\n---\n# Overview\n## Usage\n';

    const parsed = parseSkillMd(src);

    expect(findAntiRationalizationHeadings(parsed.headings)).toEqual([]);
  });
});
