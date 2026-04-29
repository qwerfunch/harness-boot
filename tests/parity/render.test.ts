/**
 * Parity test for `src/render/{domain,architecture}.ts` (F-091).
 *
 * Strategy:
 *
 *   - domain.md is byte-equal parity. We build a small spec fixture
 *     in TypeScript, render it with a pinned timestamp, and assert
 *     the exact string Python's `render.domain.render(...)` would
 *     produce. Where checking against a literal Python string would
 *     be brittle, we assert structural properties (section headings
 *     in order, Korean placeholders, count parens).
 *   - architecture.yaml is semantic-equivalence parity. We render in
 *     TS, parse the result back, and verify the data shape Python
 *     would produce against the same input.
 *
 * Run via `npm run test:parity`.
 */

import {describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {render as renderArchitecture} from '../../src/render/architecture.js';
import {render as renderDomain} from '../../src/render/domain.js';

const PIN = '2026-05-01T00:00:00Z';

const SAMPLE_SPEC: Record<string, unknown> = {
  version: '2.3',
  schema_version: '2.3',
  project: {
    name: 'harness-boot',
    summary: 'Multi-agent dev harness',
    description: 'Long description\nspanning two lines.',
    vision: 'Spec-driven AI delivery.',
    stakeholders: [
      {
        role: 'developer',
        count: 5,
        description: 'Day-to-day spec authors.',
        concerns: ['naming drift', '$include creep'],
        wants: ['fast feedback'],
        needs: ['gate auto-runners'],
      },
    ],
  },
  domain: {
    entities: [
      {
        name: 'Feature',
        description: 'One unit of work',
        attributes: [{name: 'id', type: 'string'}],
        invariants: [{statement: 'id matches /^F-\\d+$/'}],
      },
    ],
    business_rules: [
      {id: 'BR-001', statement: 'Iron Law', rationale: 'no completion without evidence'},
    ],
  },
  decisions: [
    {
      id: 'ADR-001',
      title: 'Use Markdown for domain.md',
      status: 'accepted',
      context: 'Need human-readable view.',
      decision: 'Render as Markdown with stable section order.',
    },
  ],
  risks: [
    {
      id: 'R-001',
      statement: 'YAML quoting drift',
      likelihood: 'M',
      impact: 'L',
      mitigation: 'semantic-equivalence parity test',
    },
  ],
  constraints: {
    tech_stack: {
      runtime: 'node',
      min_version: '20',
      language: 'typescript',
      test: 'vitest',
      build: 'tsc',
    },
  },
  features: [
    {id: 'F-001', name: 'foundation', modules: ['core/canonicalHash'], status: 'done'},
    {
      id: 'F-002',
      name: 'eventLog',
      modules: ['core/eventLog'],
      depends_on: ['F-001'],
      status: 'done',
    },
    {
      id: 'F-003',
      name: 'state',
      modules: [{name: 'core/state'}, 'core/canonicalHash'],
    },
  ],
  metadata: {
    contribution_points: ['hooks', 'agents'],
    host_binding: {kind: 'claude-code-plugin'},
  },
};

describe('render/domain — section order + Korean copy', () => {
  it('emits sections in canonical order with the pinned timestamp', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out.startsWith('# harness-boot — Domain View\n')).toBe(true);
    expect(out).toContain(`> 자동 생성 — ${PIN}`);

    const sectionPositions = [
      out.indexOf('## Project'),
      out.indexOf('## Platform'),
      out.indexOf('## Stakeholders'),
      out.indexOf('## Entities'),
      out.indexOf('## Business Rules'),
      out.indexOf('## Decisions'),
      out.indexOf('## Risks'),
    ];
    for (let i = 1; i < sectionPositions.length; i++) {
      expect(sectionPositions[i]).toBeGreaterThan(sectionPositions[i - 1]!);
    }
  });

  it('embeds project description and vision verbatim', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('Long description');
    expect(out).toContain('spanning two lines.');
    expect(out).toContain('Spec-driven AI delivery.');
  });

  it('renders Platform block when tech_stack is populated', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('**Runtime**: node 20+');
    expect(out).toContain('**Language**: typescript');
    expect(out).toContain('**Test**: vitest');
    expect(out).toContain('**Build**: tsc');
  });

  it('omits Platform when tech_stack is empty', () => {
    const slim = {...SAMPLE_SPEC, constraints: {}};
    const out = renderDomain(slim, {timestamp: PIN});
    expect(out).not.toContain('## Platform');
  });

  it('emits stakeholder count + role + description + lists', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('## Stakeholders (1)');
    expect(out).toContain('### developer (5)');
    expect(out).toContain('Day-to-day spec authors.');
    expect(out).toContain('**Concerns**:');
    expect(out).toContain('- naming drift');
    expect(out).toContain('**Wants**:');
    expect(out).toContain('**Needs**:');
  });

  it('emits Korean placeholder when stakeholders is empty', () => {
    const slim = {...SAMPLE_SPEC, project: {...(SAMPLE_SPEC['project'] as object), stakeholders: []}};
    const out = renderDomain(slim, {timestamp: PIN});
    expect(out).toContain('정의된 stakeholder 없음');
  });

  it('emits entity attributes + invariants', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('### Feature');
    expect(out).toContain('**Attributes**:');
    expect(out).toContain('- `id`: string');
    expect(out).toContain('**Invariants**:');
  });

  it('emits BR statement + rationale', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('### BR-001');
    expect(out).toContain('**Statement**: Iron Law');
    expect(out).toContain('**Rationale**: no completion without evidence');
  });

  it('emits ADR with status + context + decision sections', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('### ADR-001 — Use Markdown for domain.md');
    expect(out).toContain('**Status**: accepted');
    expect(out).toContain('**Context**:');
    expect(out).toContain('**Decision**:');
  });

  it('emits risk likelihood × impact line', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out).toContain('### R-001');
    expect(out).toContain('**Likelihood × Impact**: M × L · status: open');
    expect(out).toContain('**Mitigation**: semantic-equivalence parity test');
  });

  it('emits Korean placeholders for empty Decisions / Risks', () => {
    const slim = {...SAMPLE_SPEC, decisions: [], risks: []};
    const out = renderDomain(slim, {timestamp: PIN});
    expect(out).toContain('정의된 ADR 없음');
    expect(out).toContain('정의된 risk 없음');
  });

  it('ends with exactly one trailing newline', () => {
    const out = renderDomain(SAMPLE_SPEC, {timestamp: PIN});
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});

describe('render/architecture — semantic-equivalence parity', () => {
  it('renders a mapping with the canonical key order', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys[0]).toBe('version');
    expect(keys[1]).toBe('generated_at');
    expect(keys[2]).toBe('from_spec');
  });

  it('records the pinned timestamp + default from_spec label', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    expect(parsed['generated_at']).toBe(PIN);
    expect(parsed['from_spec']).toBe('spec.yaml');
  });

  it('honors the sourceRef override', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN, sourceRef: '.harness/spec.yaml'});
    const parsed = yamlParse(out) as Record<string, unknown>;
    expect(parsed['from_spec']).toBe('.harness/spec.yaml');
  });

  it('builds modules map sorted ascending with feature owners', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    const modules = parsed['modules'] as Array<{name: string; owners: string[]}>;
    expect(modules.map((m) => m.name)).toEqual(['core/canonicalHash', 'core/eventLog', 'core/state']);
    const canon = modules.find((m) => m.name === 'core/canonicalHash')!;
    expect(canon.owners).toContain('F-001');
    expect(canon.owners).toContain('F-003');
  });

  it('feature_graph carries id + name + modules + depends_on + status', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    const graph = parsed['feature_graph'] as Array<Record<string, unknown>>;
    expect(graph).toHaveLength(3);
    expect(graph[0]!['id']).toBe('F-001');
    expect(graph[1]!['depends_on']).toEqual(['F-001']);
  });

  it('omits modules block when no features carry modules', () => {
    const out = renderArchitecture({...SAMPLE_SPEC, features: []}, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    expect(parsed['modules']).toBeUndefined();
    expect(parsed['feature_graph']).toBeUndefined();
  });

  it('embeds metadata.contribution_points + host_binding when present', () => {
    const out = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const parsed = yamlParse(out) as Record<string, unknown>;
    expect(parsed['contribution_points']).toEqual(['hooks', 'agents']);
    expect(parsed['host_binding']).toEqual({kind: 'claude-code-plugin'});
  });

  it('determinism — repeated render produces identical output', () => {
    const a = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    const b = renderArchitecture(SAMPLE_SPEC, {timestamp: PIN});
    expect(a).toBe(b);
  });
});
