/**
 * Plugin-level wiring test for the response writing rules (F-135).
 *
 * Asserts the three downstream surfaces correctly link to the SSoT:
 *
 *   - `docs/communication-rules.md` exists and contains both rule
 *     families with bilingual (en + ko) headings.
 *   - `docs/templates/starter/CLAUDE.md.template` carries a section
 *     that previews the rules and links back to the SSoT.
 *   - Every `agents/*.md` file (except README.md) has the one-line
 *     link to `docs/communication-rules.md`.
 *
 * Run via `npm run test:parity`.
 */

import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const RULES_PATH = join(REPO_ROOT, 'docs', 'communication-rules.md');
const TEMPLATE_PATH = join(REPO_ROOT, 'docs', 'templates', 'starter', 'CLAUDE.md.template');
const AGENTS_DIR = join(REPO_ROOT, 'agents');

describe('communication-rules.md — single source of truth', () => {
  it('exists with non-trivial content', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    expect(text.length).toBeGreaterThan(1500);
  });

  it('declares both rule families', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    expect(text).toContain('Family 1');
    expect(text).toContain('Answer-first');
    expect(text).toContain('Family 2');
    expect(text).toContain('Native tone');
  });

  it('is single-language English (no side-by-side ko duplication)', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    // The standalone "### 한국어" heading was removed in F-136; the file
    // now reads as one English template that generalises to all languages.
    expect(text).not.toContain('### 한국어');
    // Korean reference *examples* (loanwords, rule samples) are still
    // allowed inline — only the dedicated sibling heading is gone.
  });

  it('names at least four reference languages with native-tone notes', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    // The Family 2 section should mention these as reference patterns.
    const tokens = ['Japanese', 'Chinese', 'Spanish', 'German', 'French', 'Portuguese'];
    const hits = tokens.filter((t) => text.includes(t));
    expect(hits.length).toBeGreaterThanOrEqual(4);
  });

  it('carries the F-136 progress-ID surface-discipline rule', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    expect(text).toContain('Progress-ID surface discipline');
  });

  it('carries the F-136 brevity-for-write-surfaces rule naming CHANGELOG / commit / PR', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    expect(text).toContain('Brevity for write surfaces');
    expect(text).toContain('CHANGELOG');
    expect(text).toContain('commit');
    expect(text).toContain('PR');
  });

  it('carries the F-137 plan-mode file-management rule (overwrite on task pivot)', () => {
    const text = readFileSync(RULES_PATH, 'utf-8');
    expect(text).toContain('Plan-mode file management');
    expect(text).toContain('overwrite');
  });
});

describe('CLAUDE.md.template — reminder section', () => {
  it('contains a section that previews the rules', () => {
    const text = readFileSync(TEMPLATE_PATH, 'utf-8');
    expect(text).toContain('Response writing rules');
    // F-136 — the section is now English-only; the Korean
    // "응답 작성 규칙" duplicate heading was removed.
  });

  it('links back to the SSoT', () => {
    const text = readFileSync(TEMPLATE_PATH, 'utf-8');
    expect(text).toContain('docs/communication-rules.md');
  });

  it('mentions both rule families by name', () => {
    const text = readFileSync(TEMPLATE_PATH, 'utf-8');
    expect(text).toContain('Family 1');
    expect(text).toContain('Family 2');
  });
});

describe('agents/*.md — communication-rules link', () => {
  const agentFiles = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => join(AGENTS_DIR, f));

  it('discovers a non-empty agent file set', () => {
    expect(agentFiles.length).toBeGreaterThan(10);
  });

  it.each(agentFiles)('%s links to docs/communication-rules.md', (path) => {
    const text = readFileSync(path, 'utf-8');
    expect(text).toContain('docs/communication-rules.md');
  });
});
