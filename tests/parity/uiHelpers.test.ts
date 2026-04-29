/**
 * Parity test for `src/ui/{lang,messages,dashboardConfig,render,featureResolver}.ts` (F-092).
 *
 * Coverage:
 *
 *   - lang resolver — env override, spec pin, system locale, default.
 *   - messages catalog — REQUIRED_KEYS exhaustive, EN/KO parity,
 *     formatter substitution, fallback on unknown lang/key.
 *   - dashboardConfig — env override + invalid value fallback.
 *   - render — agent chain with / without parallel groups.
 *   - featureResolver — three priority tiers + edge cases.
 *
 * Run via `npm run test:parity`.
 */

import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {maxOtherList, maxPendingList, maxUnregisteredList} from '../../src/ui/dashboardConfig.js';
import {resolve} from '../../src/ui/featureResolver.js';
import {resolveLang} from '../../src/ui/lang.js';
import {REQUIRED_KEYS, t} from '../../src/ui/messages.js';
import {renderAgentChain} from '../../src/ui/render.js';

describe('ui/lang parity', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      HARNESS_LANG: process.env['HARNESS_LANG'],
      LC_ALL: process.env['LC_ALL'],
      LANG: process.env['LANG'],
    };
    delete process.env['HARNESS_LANG'];
    delete process.env['LC_ALL'];
    delete process.env['LANG'];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('HARNESS_LANG=ko wins outright', () => {
    process.env['HARNESS_LANG'] = 'ko';
    expect(resolveLang(null)).toBe('ko');
  });

  it('HARNESS_LANG=en wins outright', () => {
    process.env['HARNESS_LANG'] = 'en';
    expect(resolveLang(null)).toBe('en');
  });

  it('spec.project.language=ko picked when env unset', () => {
    expect(resolveLang({project: {language: 'ko'}})).toBe('ko');
  });

  it('spec.project.language=auto falls through to LC_ALL', () => {
    process.env['LC_ALL'] = 'ko_KR.UTF-8';
    expect(resolveLang({project: {language: 'auto'}})).toBe('ko');
  });

  it('LC_ALL Korean variant maps to ko', () => {
    process.env['LC_ALL'] = 'ko_KR.UTF-8';
    expect(resolveLang(null)).toBe('ko');
  });

  it('LANG en_US maps to en', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    expect(resolveLang(null)).toBe('en');
  });

  it('default fallback is en', () => {
    expect(resolveLang(null)).toBe('en');
  });

  it('non-object spec is ignored', () => {
    expect(resolveLang('not a spec')).toBe('en');
  });
});

describe('ui/messages parity', () => {
  it('REQUIRED_KEYS is non-empty', () => {
    expect(REQUIRED_KEYS.length).toBeGreaterThan(20);
  });

  it('every REQUIRED_KEY resolves in EN', () => {
    for (const key of REQUIRED_KEYS) {
      const out = t(key, 'en', {n: 1, name: 'gate_0', title: 'x', total: 5, passed: 1, evidence: 1, declared: 0, required: 3, note: 'x'});
      expect(out, `missing EN translation for ${key}`).toBeTruthy();
    }
  });

  it('every REQUIRED_KEY resolves in KO', () => {
    for (const key of REQUIRED_KEYS) {
      const out = t(key, 'ko', {n: 1, name: 'gate_0', title: 'x', total: 5, passed: 1, evidence: 1, declared: 0, required: 3, note: 'x'});
      expect(out, `missing KO translation for ${key}`).toBeTruthy();
    }
  });

  it('formatter substitutes named placeholders', () => {
    expect(t('evidence', 'en', {n: 3})).toBe('evidence: 3 entries');
    expect(t('evidence', 'ko', {n: 3})).toBe('근거: 3 개');
  });

  it('unknown lang falls back to en', () => {
    expect(t('status', 'fr')).toBe('status');
  });

  it('unknown key throws', () => {
    expect(() => t('nonexistent_key')).toThrow(/unknown message key/);
  });
});

describe('ui/dashboardConfig parity', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      HARNESS_DASHBOARD_MAX_OTHER: process.env['HARNESS_DASHBOARD_MAX_OTHER'],
      HARNESS_DASHBOARD_MAX_PENDING: process.env['HARNESS_DASHBOARD_MAX_PENDING'],
      HARNESS_DASHBOARD_MAX_UNREGISTERED: process.env['HARNESS_DASHBOARD_MAX_UNREGISTERED'],
    };
    for (const k of Object.keys(savedEnv)) {
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it('defaults are 5 / 5 / 5', () => {
    expect(maxOtherList()).toBe(5);
    expect(maxPendingList()).toBe(5);
    expect(maxUnregisteredList()).toBe(5);
  });

  it('valid env overrides take effect', () => {
    process.env['HARNESS_DASHBOARD_MAX_OTHER'] = '12';
    expect(maxOtherList()).toBe(12);
  });

  it('non-int env value falls back to default', () => {
    process.env['HARNESS_DASHBOARD_MAX_OTHER'] = 'twelve';
    expect(maxOtherList()).toBe(5);
  });

  it('zero or negative env value falls back to default', () => {
    process.env['HARNESS_DASHBOARD_MAX_OTHER'] = '0';
    expect(maxOtherList()).toBe(5);
    process.env['HARNESS_DASHBOARD_MAX_OTHER'] = '-3';
    expect(maxOtherList()).toBe(5);
  });
});

describe('ui/render parity', () => {
  it('legacy zero-diff: empty groups → comma join', () => {
    expect(renderAgentChain(['a', 'b', 'c'], [])).toBe('a, b, c');
  });

  it('parallel group of 2 collapses into parenthesized block', () => {
    const out = renderAgentChain(
      ['security-engineer', 'reviewer', 'qa-engineer'],
      [['security-engineer', 'reviewer']],
    );
    expect(out).toBe('(security-engineer ∥ reviewer) → qa-engineer');
  });

  it('parallel group of 1 keeps single member outside parens', () => {
    const out = renderAgentChain(['security-engineer', 'qa-engineer'], [['security-engineer', 'reviewer']]);
    expect(out).toBe('security-engineer → qa-engineer');
  });

  it('mixed sequence interleaves singletons and parallel blocks', () => {
    const out = renderAgentChain(
      ['ux-architect', 'visual-designer', 'audio-designer', 'a11y-auditor', 'frontend-engineer'],
      [['visual-designer', 'audio-designer']],
    );
    expect(out).toBe('ux-architect → (visual-designer ∥ audio-designer) → a11y-auditor → frontend-engineer');
  });
});

describe('ui/featureResolver parity', () => {
  const spec = {
    features: [
      {id: 'F-001', title: 'login flow'},
      {id: 'F-002', title: 'logout'},
      {id: 'F-003', title: 'session expiry'},
    ],
  };

  it('@F-N exact resolves', () => {
    expect(resolve('@F-001', spec).feature).toEqual(spec.features[0]);
  });

  it('@F-N missing → kind:none', () => {
    expect(resolve('@F-999', spec).kind).toBe('none');
  });

  it('plain F-N case-insensitive resolves', () => {
    expect(resolve('f-002', spec).feature).toEqual(spec.features[1]);
  });

  it('title fuzzy single match', () => {
    const r = resolve('logout', spec);
    expect(r.kind).toBe('single');
    expect(r.feature).toEqual(spec.features[1]);
  });

  it('title fuzzy multiple match', () => {
    const r = resolve('lo', spec);
    expect(r.kind).toBe('multiple');
    expect(r.candidates).toHaveLength(2);
  });

  it('empty query → kind:none', () => {
    expect(resolve('', spec).kind).toBe('none');
    expect(resolve('   ', spec).kind).toBe('none');
  });

  it('non-string query → kind:none', () => {
    expect(resolve(null, spec).kind).toBe('none');
    expect(resolve(42, spec).kind).toBe('none');
  });

  it('spec missing features[] → kind:none', () => {
    expect(resolve('login', {}).kind).toBe('none');
  });
});
