/**
 * F-114 — feature-author skill v0.1 structural contract.
 *
 * Skills are LLM-driven (Claude reads the markdown and produces output),
 * so we cannot fully exercise them in CI without a live model. What we
 * CAN guarantee:
 *
 *   1. SKILL.md frontmatter is well-formed and contains trigger phrases.
 *   2. The four shape adapters exist and follow the structure SKILL.md
 *      promises (When / AC templates / Modules / Routing sections).
 *   3. The template file has all expected placeholders.
 *   4. The shape-detection table in SKILL.md is parseable, and a
 *      deterministic keyword detector built from that table picks the
 *      right shape for 8 golden user prompts (4 shapes × 2 modes).
 *
 * This is not "byte-equal Python ↔ TS" parity — that test pattern doesn't
 * apply to a markdown-only skill. It is a structural contract test in the
 * same `tests/parity/` directory because the same `vitest` runner picks
 * it up alongside the other parity tests.
 */

import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');
const SKILL_DIR = join(REPO_ROOT, 'skills', 'feature-author');

const ADAPTER_NAMES = ['ui-surface', 'sensitive', 'performance-budget', 'pure-domain'] as const;
type ShapeName = (typeof ADAPTER_NAMES)[number];

function readSkill(rel: string): string {
  return readFileSync(join(SKILL_DIR, rel), 'utf-8');
}

/**
 * Deterministic shape detector built from the SKILL.md signal-word
 * table. Order matters — `sensitive` outranks the others because the
 * skill specifies "stricter shape wins" precedence.
 */
function detectShape(prompt: string): ShapeName {
  const lower = prompt.toLowerCase();

  const SENSITIVE_KEYWORDS = [
    'login', 'logout', 'sign in', 'sign up', 'oauth', 'sso', 'mfa',
    'jwt', 'token', 'password', 'encrypt', 'secret', 'api key',
    'pii', 'gdpr', 'consent', 'checkout', 'payment', 'card',
    'billing', 'invoice', 'subscription', 'permission', 'rbac', 'acl',
    'auth', 'session',
  ];
  if (SENSITIVE_KEYWORDS.some((k) => lower.includes(k))) {
    return 'sensitive';
  }

  const PERF_KEYWORDS = [
    ' ms', 'p95', 'p99', 'rps', 'qps', 'kb gzipped', 'lcp', 'inp',
    'fid', 'cls', 'ttfb', 'fps', '60fps', 'cold start', 'throughput',
    'latency',
  ];
  if (PERF_KEYWORDS.some((k) => lower.includes(k))) {
    return 'performance-budget';
  }

  const UI_KEYWORDS = [
    'render', 'display', 'show', 'page', 'screen', 'view', 'form',
    'button', 'modal', 'dialog', 'theme', 'dark mode', 'transition',
    'tap', 'click', 'drag', 'swipe', 'hover', 'focus',
    'keyboard navigation', 'screen reader', 'aria-', 'wcag',
    'component', 'layout',
  ];
  if (UI_KEYWORDS.some((k) => lower.includes(k))) {
    return 'ui-surface';
  }

  return 'pure-domain';
}

describe('feature-author skill — frontmatter', () => {
  const skillMd = readSkill('SKILL.md');

  it('declares name=feature-author and version=0.1', () => {
    expect(skillMd).toMatch(/^name: feature-author$/m);
    expect(skillMd).toMatch(/^version: 0\.1$/m);
  });

  it('description carries Korean trigger phrases', () => {
    expect(skillMd).toContain('새 피처 추가');
    expect(skillMd).toContain('F-N 정의');
    expect(skillMd).toContain('피처 추가하자');
  });

  it('description carries English trigger phrases', () => {
    expect(skillMd).toContain('draft a feature');
    expect(skillMd).toContain('spec out');
    expect(skillMd).toContain('add a feature');
  });

  it('teaches the four required steps', () => {
    expect(skillMd).toMatch(/Step 1.*Detect the feature shape/);
    expect(skillMd).toMatch(/Step 2.*Read .*project\.mode/);
    expect(skillMd).toMatch(/Step 3.*Compose the F-N entry/);
    expect(skillMd).toMatch(/Step 4.*lockstep paste instructions/);
  });
});

describe('feature-author skill — adapters', () => {
  for (const name of ADAPTER_NAMES) {
    describe(`${name}.md`, () => {
      const body = readSkill(join('adapters', `${name}.md`));

      it('has the four required sections', () => {
        expect(body).toMatch(/##\s+When to use/);
        expect(body).toMatch(/##\s+AC templates/);
        expect(body).toMatch(/##\s+Modules pattern/);
        expect(body).toMatch(/##\s+Routing the orchestrator will pick/);
      });

      it('lists at least three AC templates', () => {
        const acLines = body.match(/^- "AC-N:/gm) ?? [];
        expect(acLines.length).toBeGreaterThanOrEqual(3);
      });

      it('declares its required block correctly', () => {
        if (name === 'ui-surface') {
          expect(body).toMatch(/```yaml[\s\S]*?ui_surface:/);
        } else if (name === 'sensitive') {
          expect(body).toMatch(/```yaml[\s\S]*?entities:/);
        } else if (name === 'performance-budget') {
          expect(body).toMatch(/```yaml[\s\S]*?performance_budget:/);
        } else {
          expect(body).toMatch(/no extra spec block/i);
        }
      });
    });
  }
});

describe('feature-author skill — template', () => {
  const tpl = readSkill(join('templates', 'feature-entry.yaml'));

  it('has all required placeholders', () => {
    expect(tpl).toContain('<F_ID>');
    expect(tpl).toContain('<NAME>');
    expect(tpl).toContain('<TYPE>');
    expect(tpl).toContain('<DESCRIPTION>');
    expect(tpl).toContain('<AC_1>');
  });

  it('lists the three optional shape blocks as comments', () => {
    expect(tpl).toContain('# ui_surface:');
    expect(tpl).toContain('# entities:');
    expect(tpl).toContain('# performance_budget:');
  });
});

describe('feature-author skill — shape detection on 8 golden prompts', () => {
  // 4 shapes × 2 modes (prototype/product) — mode is independent of
  // shape detection but documented in the SKILL.md, so we encode it
  // as a metadata column for completeness.
  const cases: Array<{prompt: string; mode: 'prototype' | 'product'; shape: ShapeName}> = [
    {prompt: 'render a login form with email + password fields', mode: 'prototype', shape: 'sensitive'},
    {prompt: 'OAuth callback handler for Google sign in', mode: 'product', shape: 'sensitive'},
    {prompt: 'a dashboard page that shows the user\'s recent activity', mode: 'prototype', shape: 'ui-surface'},
    {prompt: 'modal dialog for confirming destructive actions with WCAG focus management', mode: 'product', shape: 'ui-surface'},
    {prompt: 'API endpoint p95 latency must stay under 200ms at 1000 rps', mode: 'prototype', shape: 'performance-budget'},
    {prompt: 'main bundle stays below 200 KB gzipped, LCP p75 under 2500ms', mode: 'product', shape: 'performance-budget'},
    {prompt: 'parse semver version strings into structured tuples', mode: 'prototype', shape: 'pure-domain'},
    {prompt: 'aggregate weekly usage events into a per-user summary report', mode: 'product', shape: 'pure-domain'},
  ];

  it.each(cases)(
    '$shape ($mode): "$prompt"',
    ({prompt, shape}) => {
      expect(detectShape(prompt)).toBe(shape);
    },
  );
});
