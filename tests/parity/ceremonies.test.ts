/**
 * Parity test for `src/ceremonies/{kickoff,retro,designReview,inbox}.ts` (F-097).
 *
 * Coverage:
 *
 *   - kickoff: shape detection truth table, agent ordering with
 *     has_audio, parallel groups, idempotency, template structure.
 *   - retro: events.log analyze() returns the right counters,
 *     template renders machine sections + LLM placeholders.
 *   - designReview: reviewer ordering, audio insertion, template + event.
 *   - inbox: file scan, frontmatter parsing, has_answer detection.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {generateDesignReview, reviewersFor} from '../../src/ceremonies/designReview.js';
import {openQuestions, scanInbox} from '../../src/ceremonies/inbox.js';
import {
  agentsForShapes,
  detectShapes,
  generateKickoff,
  hasAudioFlag,
  parallelGroupsForShapes,
} from '../../src/ceremonies/kickoff.js';
import {analyze, generateRetro} from '../../src/ceremonies/retro.js';

interface Workspace {
  dir: string;
}

function makeWorkspace(): Workspace {
  return {dir: mkdtempSync(join(tmpdir(), 'cer-'))};
}

describe('kickoff.detectShapes', () => {
  it('empty title + AC + modules → baseline-empty-vague', () => {
    expect(detectShapes({title: '', acceptance_criteria: [], modules: []})).toEqual([
      'baseline-empty-vague',
    ]);
  });

  it('ui_surface.present + has_audio resolves to ui_surface.present + feature_completion', () => {
    const shapes = detectShapes({
      title: 't',
      ui_surface: {present: true, has_audio: true},
    });
    expect(shapes).toContain('ui_surface.present');
    expect(shapes[shapes.length - 1]).toBe('feature_completion');
  });

  it('performance_budget triggers performance_budget shape', () => {
    const shapes = detectShapes({title: 't', performance_budget: {lcp_ms: 2000}});
    expect(shapes).toContain('performance_budget');
  });

  it('feature.sensitive=true triggers sensitive_or_auth', () => {
    const shapes = detectShapes({title: 't', sensitive: true});
    expect(shapes).toContain('sensitive_or_auth');
  });

  it('domain entity sensitive=true referenced by title triggers sensitive_or_auth', () => {
    const spec = {domain: {entities: [{name: 'Token', sensitive: true}]}};
    const shapes = detectShapes({title: 'rotate token', modules: []}, spec);
    expect(shapes).toContain('sensitive_or_auth');
  });

  it('no specialist shape → pure_domain_logic', () => {
    const shapes = detectShapes({title: 'logic', modules: ['core/x']});
    expect(shapes).toContain('pure_domain_logic');
    expect(shapes[shapes.length - 1]).toBe('feature_completion');
  });
});

describe('kickoff.agentsForShapes + parallelGroups', () => {
  it('ui_surface.present has audio-designer inserted before a11y-auditor', () => {
    const agents = agentsForShapes(['ui_surface.present', 'feature_completion'], true);
    const audioIdx = agents.indexOf('audio-designer');
    const a11yIdx = agents.indexOf('a11y-auditor');
    expect(audioIdx).toBeGreaterThan(-1);
    expect(audioIdx).toBeLessThan(a11yIdx);
  });

  it('ui_surface.present without has_audio omits audio-designer', () => {
    const agents = agentsForShapes(['ui_surface.present'], false);
    expect(agents).not.toContain('audio-designer');
  });

  it('parallelGroupsForShapes returns sensitive group when shape matches', () => {
    const groups = parallelGroupsForShapes(['sensitive_or_auth']);
    expect(groups).toEqual([['security-engineer', 'reviewer']]);
  });

  it('hasAudioFlag reads ui_surface.has_audio', () => {
    expect(hasAudioFlag({ui_surface: {has_audio: true}})).toBe(true);
    expect(hasAudioFlag({ui_surface: {has_audio: false}})).toBe(false);
    expect(hasAudioFlag({})).toBe(false);
  });
});

describe('kickoff.generateKickoff', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('writes the template + event and returns the kickoff path', () => {
    const path = generateKickoff(ws.dir, 'F-001', ['feature_completion'], {
      timestamp: '2026-05-01T00:00:00Z',
    });
    expect(existsSync(path)).toBe(true);
    const body = readFileSync(path, 'utf-8');
    expect(body).toContain('# Kickoff — F-001');
    expect(body).toContain('## qa-engineer 의 관점');
    const events = readFileSync(join(ws.dir, 'events.log'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0);
    expect(events).toHaveLength(1);
    const ev = JSON.parse(events[0]!);
    expect(ev.type).toBe('kickoff_started');
    expect(ev.feature).toBe('F-001');
  });

  it('idempotent — second call without force does not rewrite or re-emit', () => {
    generateKickoff(ws.dir, 'F-001', ['feature_completion'], {
      timestamp: '2026-05-01T00:00:00Z',
    });
    const eventsBefore = readFileSync(join(ws.dir, 'events.log'), 'utf-8');
    generateKickoff(ws.dir, 'F-001', ['feature_completion'], {
      timestamp: '2026-05-02T00:00:00Z',
    });
    const eventsAfter = readFileSync(join(ws.dir, 'events.log'), 'utf-8');
    expect(eventsAfter).toBe(eventsBefore);
  });

  it('force=true rewrites and re-emits', () => {
    generateKickoff(ws.dir, 'F-001', ['feature_completion'], {
      timestamp: '2026-05-01T00:00:00Z',
    });
    generateKickoff(ws.dir, 'F-001', ['feature_completion'], {
      timestamp: '2026-05-02T00:00:00Z',
      force: true,
    });
    const events = readFileSync(join(ws.dir, 'events.log'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0);
    expect(events).toHaveLength(2);
  });

  it('prototype mode emits 1 bullet per agent instead of 3', () => {
    const path = generateKickoff(ws.dir, 'F-002', ['feature_completion'], {
      timestamp: '2026-05-01T00:00:00Z',
      mode: 'prototype',
    });
    const body = readFileSync(path, 'utf-8');
    expect(body).toContain('mode: `prototype`');
    expect(body).toContain('프로토타입 모드');
  });
});

describe('retro.analyze + generateRetro', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('analyze counts gate fails, kickoff, design-review, questions', () => {
    const events = [
      {type: 'gate_recorded', feature: 'F-1', gate: 'gate_0', result: 'fail', ts: 'A'},
      {type: 'gate_recorded', feature: 'F-1', gate: 'gate_1', result: 'pass', ts: 'B'},
      {type: 'kickoff_started', feature: 'F-1'},
      {type: 'design_review_opened', feature: 'F-1'},
      {type: 'question_opened', feature: 'F-1'},
      {type: 'question_answered', feature: 'F-1'},
      {type: 'feature_done', feature: 'F-1'},
    ];
    const a = analyze(events, 'F-1');
    expect(a.completed).toBe(true);
    expect(a.first_gate_fail!['gate']).toBe('gate_0');
    expect(a.kickoff_opened).toBe(true);
    expect(a.design_review_opened).toBe(true);
    expect(a.questions_opened).toBe(1);
    expect(a.questions_answered).toBe(1);
  });

  it('generateRetro writes machine sections + emits feature_retro_written', () => {
    writeFileSync(
      join(ws.dir, 'events.log'),
      [
        '{"type":"kickoff_started","feature":"F-001"}',
        '{"type":"feature_done","feature":"F-001"}',
      ].join('\n') + '\n',
      'utf-8',
    );
    const path = generateRetro(ws.dir, 'F-001', {timestamp: '2026-05-01T00:00:00Z'});
    const body = readFileSync(path, 'utf-8');
    expect(body).toContain('# Retrospective — F-001');
    expect(body).toContain('## What Shipped');
    expect(body).toContain('Kickoff opened: ✅');
  });

  it('prototype mode skips LLM sections', () => {
    writeFileSync(
      join(ws.dir, 'events.log'),
      '{"type":"feature_done","feature":"F-002"}\n',
      'utf-8',
    );
    const path = generateRetro(ws.dir, 'F-002', {
      timestamp: '2026-05-01T00:00:00Z',
      mode: 'prototype',
    });
    const body = readFileSync(path, 'utf-8');
    expect(body).not.toContain('Risks Materialized');
    expect(body).not.toContain('Reviewer Reflection');
  });

  it('idempotent — second call preserves user-curated content', () => {
    writeFileSync(join(ws.dir, 'events.log'), '{"type":"feature_done","feature":"F-003"}\n', 'utf-8');
    const path = generateRetro(ws.dir, 'F-003', {timestamp: '2026-05-01T00:00:00Z'});
    writeFileSync(path, '# user override\n', 'utf-8');
    generateRetro(ws.dir, 'F-003', {timestamp: '2026-05-02T00:00:00Z'});
    expect(readFileSync(path, 'utf-8')).toBe('# user override\n');
  });
});

describe('designReview', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('reviewersFor returns 3 reviewers without audio', () => {
    expect(reviewersFor(false)).toEqual([
      'visual-designer',
      'frontend-engineer',
      'a11y-auditor',
    ]);
  });

  it('reviewersFor inserts audio-designer before a11y-auditor', () => {
    const list = reviewersFor(true);
    expect(list.indexOf('audio-designer')).toBeLessThan(list.indexOf('a11y-auditor'));
  });

  it('generateDesignReview writes template + emits event', () => {
    const path = generateDesignReview(ws.dir, 'F-001', {
      hasAudio: false,
      timestamp: '2026-05-01T00:00:00Z',
    });
    const body = readFileSync(path, 'utf-8');
    expect(body).toContain('# Design Review — F-001');
    expect(body).toContain('## visual-designer concerns');

    const events = readFileSync(join(ws.dir, 'events.log'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0);
    const ev = JSON.parse(events[0]!);
    expect(ev.type).toBe('design_review_opened');
    expect(ev.has_audio).toBe(false);
  });
});

describe('inbox', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    mkdirSync(join(ws.dir, '_workspace', 'questions'), {recursive: true});
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('returns empty list when no questions directory exists', () => {
    rmSync(join(ws.dir, '_workspace'), {recursive: true, force: true});
    expect(scanInbox(ws.dir)).toEqual([]);
  });

  it('parses filename + frontmatter + answer detection', () => {
    const qDir = join(ws.dir, '_workspace', 'questions');
    writeFileSync(
      join(qDir, 'F-1--frontend-engineer--ux-architect.md'),
      '---\nblocking: true\n---\n## Question\n\nQ?\n',
      'utf-8',
    );
    writeFileSync(
      join(qDir, 'F-1--reviewer--qa-engineer.md'),
      '---\nblocking: false\n---\n## Question\n\nQ?\n## Answer\n\nA.\n',
      'utf-8',
    );
    const all = scanInbox(ws.dir);
    expect(all).toHaveLength(2);
    expect(all[0]!.blocking).toBe(true);
    expect(all[0]!.has_answer).toBe(false);
    expect(all[1]!.has_answer).toBe(true);

    const open = openQuestions(ws.dir);
    expect(open).toHaveLength(1);
  });

  it('feature filter narrows scan results', () => {
    const qDir = join(ws.dir, '_workspace', 'questions');
    writeFileSync(join(qDir, 'F-1--a--b.md'), '## Question\n', 'utf-8');
    writeFileSync(join(qDir, 'F-2--a--b.md'), '## Question\n', 'utf-8');
    expect(scanInbox(ws.dir, 'F-2')).toHaveLength(1);
  });
});
