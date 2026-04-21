import { describe, expect, it } from 'vitest';

import { validateSpec } from '../../../src/core/spec/validate.js';

// 최소 유효 spec 을 만드는 헬퍼 — 각 테스트는 이 기본형을 변형해 특정 규칙을 유도한다.
function baseSpec(): Record<string, unknown> {
  return {
    version: '2.3.6',
    project: { name: 'demo', version: '0.1.0' },
    domain: { overview: 'x' },
    constraints: {
      tech_stack: {
        language: 'TypeScript 5',
        runtime: 'Node 20',
        framework: 'Claude Code Plugin API v1',
        testing: 'Vitest 2',
      },
      architecture: { pattern: 'layered' },
      quality: {
        coverage_threshold: 85,
        required_gates: [0, 1, 2, 3, 4, 5],
        prototype_mode: false,
      },
    },
    deliverable: {
      type: 'library',
      entry_points: [{ name: 'cli', command: 'node bin' }],
      smoke_scenarios: [
        { id: 'SS-001', description: 'd', steps: ['s'], success_criteria: 'ok' },
      ],
    },
    features: [
      {
        id: 'F-001',
        type: 'skeleton',
        title: 'Walking Skeleton',
        priority: 1,
        status: 'planned',
        test_strategy: 'tdd',
        tdd_focus: ['bootstrap'],
        acceptance_criteria: ['boot ok'],
      },
    ],
  };
}

const rulesOf = (data: unknown): string[] =>
  validateSpec(data).findings.map((f) => f.rule);

describe('validateSpec — rule 1: spec/cycle', () => {
  it('passes on acyclic depends_on graph', () => {
    const spec = baseSpec();
    (spec['features'] as unknown[]).push({
      id: 'F-002',
      type: 'feature',
      title: 'dep',
      priority: 2,
      status: 'planned',
      test_strategy: 'tdd',
      tdd_focus: ['x'],
      acceptance_criteria: ['x'],
      depends_on: ['F-001'],
    });

    expect(rulesOf(spec)).not.toContain('spec/cycle');
  });

  it('flags a simple 2-node cycle', () => {
    const spec = baseSpec();
    (spec['features'] as unknown[])[0] = {
      ...(spec['features'] as unknown[])[0] as object,
      depends_on: ['F-002'],
    };
    (spec['features'] as unknown[]).push({
      id: 'F-002',
      type: 'feature',
      title: 'b',
      priority: 2,
      status: 'planned',
      test_strategy: 'tdd',
      tdd_focus: ['x'],
      acceptance_criteria: ['x'],
      depends_on: ['F-001'],
    });

    const findings = validateSpec(spec).findings.filter(
      (f) => f.rule === 'spec/cycle',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/F-001/);
    expect(findings[0]?.message).toMatch(/F-002/);
  });

  it('flags self-loop as cycle', () => {
    const spec = baseSpec();
    (spec['features'] as unknown[])[0] = {
      ...(spec['features'] as unknown[])[0] as object,
      depends_on: ['F-001'],
    };

    expect(rulesOf(spec)).toContain('spec/cycle');
  });
});

describe('validateSpec — rule 2: spec/walking-skeleton', () => {
  it('passes when features[0].type === skeleton', () => {
    expect(rulesOf(baseSpec())).not.toContain('spec/walking-skeleton');
  });

  it('flags when features[0].type !== skeleton', () => {
    const spec = baseSpec();
    (spec['features'] as unknown[])[0] = {
      ...(spec['features'] as unknown[])[0] as object,
      type: 'feature',
    };

    expect(rulesOf(spec)).toContain('spec/walking-skeleton');
  });

  it('does not flag when prototype_mode is true', () => {
    const spec = baseSpec();
    ((spec['constraints'] as Record<string, unknown>)['quality'] as Record<
      string,
      unknown
    >)['prototype_mode'] = true;
    (spec['features'] as unknown[])[0] = {
      ...(spec['features'] as unknown[])[0] as object,
      type: 'feature',
    };

    expect(rulesOf(spec)).not.toContain('spec/walking-skeleton');
  });

  it('flags when features array is empty', () => {
    const spec = baseSpec();
    spec['features'] = [];

    expect(rulesOf(spec)).toContain('spec/walking-skeleton');
  });
});

describe('validateSpec — rule 3: spec/deliverable-completeness', () => {
  it('passes when library has ≥ 1 entry_points and ≥ 1 smoke_scenarios', () => {
    expect(rulesOf(baseSpec())).not.toContain(
      'spec/deliverable-completeness',
    );
  });

  it('flags when library has empty entry_points', () => {
    const spec = baseSpec();
    (spec['deliverable'] as Record<string, unknown>)['entry_points'] = [];

    expect(rulesOf(spec)).toContain('spec/deliverable-completeness');
  });

  it('flags when library has empty smoke_scenarios', () => {
    const spec = baseSpec();
    (spec['deliverable'] as Record<string, unknown>)['smoke_scenarios'] = [];

    expect(rulesOf(spec)).toContain('spec/deliverable-completeness');
  });

  it('does not flag when type=other with empty arrays', () => {
    const spec = baseSpec();
    (spec['deliverable'] as Record<string, unknown>)['type'] = 'other';
    (spec['deliverable'] as Record<string, unknown>)['entry_points'] = [];
    (spec['deliverable'] as Record<string, unknown>)['smoke_scenarios'] = [];

    expect(rulesOf(spec)).not.toContain('spec/deliverable-completeness');
  });
});

describe('validateSpec — rule 4: spec/sensitive-enforcement', () => {
  const addFeature = (spec: Record<string, unknown>, extra: object): void => {
    (spec['features'] as unknown[]).push({
      id: 'F-X',
      type: 'feature',
      title: 'x',
      priority: 2,
      status: 'planned',
      test_strategy: 'integration',
      test_strategy_reason: 'r',
      acceptance_criteria: ['x'],
      ...extra,
    });
  };

  it('flags feature whose modules[] include a hook/gate/audit-prefix name without tdd', () => {
    const spec = baseSpec();
    addFeature(spec, { modules: ['hooks'] });

    expect(rulesOf(spec)).toContain('spec/sensitive-enforcement');
  });

  it('flags feature whose title starts with Auth/Payment', () => {
    const spec = baseSpec();
    addFeature(spec, { title: 'Authentication flow' });

    expect(rulesOf(spec)).toContain('spec/sensitive-enforcement');
  });

  it('does not flag sensitive-prefixed feature when test_strategy=tdd', () => {
    const spec = baseSpec();
    addFeature(spec, {
      modules: ['hooks'],
      test_strategy: 'tdd',
      tdd_focus: ['matcher'],
    });

    expect(rulesOf(spec)).not.toContain('spec/sensitive-enforcement');
  });

  it('respects explicit sensitive: false override but emits warning', () => {
    const spec = baseSpec();
    addFeature(spec, { modules: ['hooks'], sensitive: false });

    const findings = validateSpec(spec).findings.filter(
      (f) => f.rule === 'spec/sensitive-enforcement',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
  });
});

describe('validateSpec — rule 5: spec/strategy-required-fields', () => {
  it('flags tdd without tdd_focus', () => {
    const spec = baseSpec();
    delete (spec['features'] as Record<string, unknown>[])[0]!['tdd_focus'];

    expect(rulesOf(spec)).toContain('spec/strategy-required-fields');
  });

  it('flags state-verification without test_strategy_reason', () => {
    const spec = baseSpec();
    (spec['features'] as Record<string, unknown>[])[0] = {
      ...(spec['features'] as Record<string, unknown>[])[0]!,
      test_strategy: 'state-verification',
      tdd_focus: undefined,
    };

    expect(rulesOf(spec)).toContain('spec/strategy-required-fields');
  });

  it('passes integration with non-empty reason', () => {
    const spec = baseSpec();
    (spec['features'] as Record<string, unknown>[])[0] = {
      ...(spec['features'] as Record<string, unknown>[])[0]!,
      type: 'feature',
      test_strategy: 'integration',
      test_strategy_reason: 'fs integration',
      tdd_focus: undefined,
    };
    ((spec['constraints'] as Record<string, unknown>)['quality'] as Record<
      string,
      unknown
    >)['prototype_mode'] = true;

    expect(rulesOf(spec)).not.toContain('spec/strategy-required-fields');
  });
});

describe('validateSpec — rule 6: spec/framework-required', () => {
  it('flags missing framework', () => {
    const spec = baseSpec();
    delete ((spec['constraints'] as Record<string, unknown>)[
      'tech_stack'
    ] as Record<string, unknown>)['framework'];

    expect(rulesOf(spec)).toContain('spec/framework-required');
  });

  it('flags empty framework string', () => {
    const spec = baseSpec();
    ((spec['constraints'] as Record<string, unknown>)['tech_stack'] as Record<
      string,
      unknown
    >)['framework'] = '   ';

    expect(rulesOf(spec)).toContain('spec/framework-required');
  });
});

describe('validateSpec — rule 7: spec/module-similarity', () => {
  it('emits warning for confusable module names across features', () => {
    const spec = baseSpec();
    (spec['features'] as Record<string, unknown>[])[0]!['modules'] = ['linter'];
    (spec['features'] as unknown[]).push({
      id: 'F-002',
      type: 'feature',
      title: 'b',
      priority: 2,
      status: 'planned',
      test_strategy: 'tdd',
      tdd_focus: ['x'],
      acceptance_criteria: ['x'],
      modules: ['lnter'],
    });

    const findings = validateSpec(spec).findings.filter(
      (f) => f.rule === 'spec/module-similarity',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
  });
});

describe('validateSpec — resilience', () => {
  it('returns empty on non-object input without throwing', () => {
    expect(() => validateSpec(null)).not.toThrow();
    expect(validateSpec(null).findings.length).toBeGreaterThan(0);
  });

  it('returns empty on array input', () => {
    expect(() => validateSpec([])).not.toThrow();
  });
});
