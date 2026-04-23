// harness-boot — spec.yaml 검증 규칙 모음 (F-006)
//
// 설계 §5.1 의 6 개 규칙 + 부가 1 개(module 유사도).  각 규칙은 순수 함수로
// parsed 객체 를 받아 SpecFinding 배열을 반환한다.  타입 narrowing 은 각
// 규칙이 자체적으로 수행하며, 구조 불일치는 (가능한 한) 조용히 스킵한다 —
// 상위 JSON Schema 가 먼저 거칠게 막고 이 레이어는 의미 규칙만 다룬다.

import { findSimilarModulePairs } from './similarity.js';
import {
  SENSITIVE_NAME_PATTERN,
  type SpecFinding,
  type SpecRuleId,
} from './types.js';

type RawFeature = {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  status?: unknown;
  test_strategy?: unknown;
  test_strategy_reason?: unknown;
  tdd_focus?: unknown;
  modules?: unknown;
  depends_on?: unknown;
  sensitive?: unknown;
};

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asFeatures(data: unknown): readonly RawFeature[] {
  if (!isRecord(data)) return [];
  const features = data['features'];
  if (!Array.isArray(features)) return [];
  return features.filter(isRecord) as readonly RawFeature[];
}

// ---------------------------------------------------------------------------
// Rule 1 — spec/cycle : depends_on 그래프가 비순환이어야 한다.
// ---------------------------------------------------------------------------

export function checkCycles(data: unknown): SpecFinding[] {
  const features = asFeatures(data);
  const graph = new Map<string, string[]>();
  for (const f of features) {
    const id = asString(f.id);
    if (!id) continue;
    graph.set(id, asStringArray(f.depends_on));
  }

  const findings: SpecFinding[] = [];
  const colour = new Map<string, 'white' | 'grey' | 'black'>();
  for (const id of graph.keys()) colour.set(id, 'white');

  const reportedCycles = new Set<string>();

  const dfs = (node: string, stack: string[]): void => {
    colour.set(node, 'grey');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      const state = colour.get(next);
      if (state === 'grey') {
        const idx = stack.indexOf(next);
        const cycle = stack.slice(idx).concat(next);
        const key = [...cycle].sort().join(',');
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          findings.push(cycleFinding(cycle));
        }
      } else if (state === 'white') {
        dfs(next, stack);
      }
    }
    stack.pop();
    colour.set(node, 'black');
  };

  for (const id of graph.keys()) {
    if (colour.get(id) === 'white') dfs(id, []);
  }
  return findings;
}

function cycleFinding(cycle: readonly string[]): SpecFinding {
  return {
    rule: 'spec/cycle',
    severity: 'error',
    message: `depends_on 에 순환 의존성이 있다: ${cycle.join(' → ')}`,
    path: 'features[].depends_on',
  };
}

// ---------------------------------------------------------------------------
// Rule 2 — spec/walking-skeleton : features[0].type == 'skeleton'
//                                  (prototype_mode=true 면 완화).
// ---------------------------------------------------------------------------

export function checkWalkingSkeleton(data: unknown): SpecFinding[] {
  if (!isRecord(data)) return [];
  const constraints = data['constraints'];
  const prototype =
    isRecord(constraints) &&
    isRecord(constraints['quality']) &&
    (constraints['quality'] as Record<string, unknown>)['prototype_mode'] ===
      true;
  if (prototype) return [];

  const features = asFeatures(data);
  if (features.length === 0) {
    return [
      {
        rule: 'spec/walking-skeleton',
        severity: 'error',
        message:
          'features 배열이 비어 있다 — Walking Skeleton 피처가 최소 하나 필요하다.',
        path: 'features',
      },
    ];
  }
  const first = features[0] as RawFeature;
  if (first.type !== 'skeleton') {
    return [
      {
        rule: 'spec/walking-skeleton',
        severity: 'error',
        message: `features[0].type 은 'skeleton' 이어야 한다 (현재: ${String(
          first.type,
        )}).  prototype_mode=true 로 예외 처리할 수 있다.`,
        path: 'features[0].type',
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Rule 3 — spec/deliverable-completeness :
//   type ∈ {library, cli, web-service, ui, data-pipeline} → entry_points ·
//   smoke_scenarios 각각 ≥ 1.  type=other 는 완화.
// ---------------------------------------------------------------------------

const REQUIRES_DELIVERABLE = new Set([
  'library',
  'cli',
  'web-service',
  'ui',
  'data-pipeline',
]);

export function checkDeliverableCompleteness(data: unknown): SpecFinding[] {
  if (!isRecord(data)) return [];
  const d = data['deliverable'];
  if (!isRecord(d)) return [];
  const type = asString(d['type']) ?? 'other';
  if (!REQUIRES_DELIVERABLE.has(type)) return [];

  const findings: SpecFinding[] = [];
  const entries = d['entry_points'];
  const scenarios = d['smoke_scenarios'];
  if (!Array.isArray(entries) || entries.length === 0) {
    findings.push({
      rule: 'spec/deliverable-completeness',
      severity: 'error',
      message: `deliverable.type=${type} 는 entry_points 가 최소 하나 필요하다.`,
      path: 'deliverable.entry_points',
    });
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    findings.push({
      rule: 'spec/deliverable-completeness',
      severity: 'error',
      message: `deliverable.type=${type} 는 smoke_scenarios 가 최소 하나 필요하다.`,
      path: 'deliverable.smoke_scenarios',
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 4 — spec/sensitive-enforcement :
//   title 이나 modules[] 중 하나라도 sensitive 정규식에 매치되면 암묵적으로
//   sensitive 로 간주, test_strategy='tdd' 를 강제.  sensitive: false 로 명시
//   override 하면 warning 으로 다운그레이드.
// ---------------------------------------------------------------------------

export function checkSensitiveEnforcement(data: unknown): SpecFinding[] {
  const findings: SpecFinding[] = [];
  for (const f of asFeatures(data)) {
    const title = asString(f.title) ?? '';
    const modules = asStringArray(f.modules);
    const inferred =
      SENSITIVE_NAME_PATTERN.test(title) ||
      modules.some((m) => SENSITIVE_NAME_PATTERN.test(m));
    if (!inferred) continue;

    const strategy = asString(f.test_strategy);
    if (strategy === 'tdd') continue;

    const id = asString(f.id) ?? '?';
    const explicitOptOut = f.sensitive === false;
    findings.push({
      rule: 'spec/sensitive-enforcement',
      severity: explicitOptOut ? 'warning' : 'error',
      message: explicitOptOut
        ? `${id} 는 sensitive 이름을 갖지만 'sensitive: false' 로 override 되어 있다 (검토 권장).`
        : `${id} 는 sensitive 이름(${title || modules.join(',')}) 을 가지므로 test_strategy='tdd' 가 필요하다.`,
      path: `features[${id}].test_strategy`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 5 — spec/strategy-required-fields :
//   tdd → tdd_focus 필요.
//   integration / state-verification → test_strategy_reason 필요.
// ---------------------------------------------------------------------------

export function checkStrategyRequiredFields(data: unknown): SpecFinding[] {
  const findings: SpecFinding[] = [];
  for (const f of asFeatures(data)) {
    const strategy = asString(f.test_strategy);
    const id = asString(f.id) ?? '?';
    if (strategy === 'tdd') {
      const focus = f.tdd_focus;
      if (!Array.isArray(focus) || focus.length === 0) {
        findings.push({
          rule: 'spec/strategy-required-fields',
          severity: 'error',
          message: `${id}: test_strategy='tdd' 는 tdd_focus 배열이 필요하다 (≥ 1).`,
          path: `features[${id}].tdd_focus`,
        });
      }
    }
    if (strategy === 'integration' || strategy === 'state-verification') {
      const reason = asString(f.test_strategy_reason) ?? '';
      if (reason.trim() === '') {
        findings.push({
          rule: 'spec/strategy-required-fields',
          severity: 'error',
          message: `${id}: test_strategy='${strategy}' 는 test_strategy_reason 이 필요하다.`,
          path: `features[${id}].test_strategy_reason`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Rule 6 — spec/framework-required : constraints.tech_stack.framework 필수.
// ---------------------------------------------------------------------------

export function checkFrameworkRequired(data: unknown): SpecFinding[] {
  if (!isRecord(data)) return [];
  const constraints = data['constraints'];
  if (!isRecord(constraints)) return [];
  const stack = constraints['tech_stack'];
  if (!isRecord(stack)) return [];
  const framework = asString(stack['framework']) ?? '';
  if (framework.trim() === '') {
    return [
      {
        rule: 'spec/framework-required',
        severity: 'error',
        message:
          'constraints.tech_stack.framework 는 공란일 수 없다 — 사용 중인 플랫폼/프레임워크를 명시한다.',
        path: 'constraints.tech_stack.framework',
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Rule 7 — spec/module-similarity : 모든 피처의 modules[] 를 합친 유일한
// 이름 집합에서 유사 이름 쌍을 탐지.  warning.
// ---------------------------------------------------------------------------

export function checkModuleSimilarity(data: unknown): SpecFinding[] {
  const names = new Set<string>();
  for (const f of asFeatures(data)) {
    for (const m of asStringArray(f.modules)) names.add(m);
  }
  const pairs = findSimilarModulePairs([...names]);
  return pairs.map((p) => ({
    rule: 'spec/module-similarity' as SpecRuleId,
    severity: 'warning' as const,
    message: `module 이름 '${p.a}' 와 '${p.b}' 가 지나치게 유사하다 (distance=${p.distance}). 오타 가능성 검토.`,
    path: 'features[].modules',
  }));
}

// ---------------------------------------------------------------------------
// Structural sanity — 최소 루트 형식이 object 가 아니면 하위 규칙이 전부
// 조용히 스킵되므로, 사용자가 혼란스럽지 않도록 한 건만 보고한다.
// ---------------------------------------------------------------------------

export function checkRootShape(data: unknown): SpecFinding[] {
  if (isRecord(data)) return [];
  return [
    {
      rule: 'spec/framework-required',
      severity: 'error',
      message:
        'spec 루트는 객체여야 한다 — 배열 · null · scalar 입력은 거절된다.',
      path: '(root)',
    },
  ];
}
