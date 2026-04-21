// harness-boot — spec.yaml 도메인 타입 (F-006)
//
// 본 타입 집합은 `spec.yaml` 의 **구조 계약** 이며, `schemas/spec.schema.json`
// 과 의미적으로 동일해야 한다.  TypeScript 쪽은 엄격한 타입 안전, JSON Schema
// 쪽은 IDE / CI 의 범용 검증을 담당한다.
//
// 사용자 입력의 첫 번째 해석 지점이므로 **관용적(tolerant)** 으로 설계한다 —
// parser 는 unknown 을 반환하고, 개별 규칙이 narrowing · reporting 을 담당한다.

export type DeliverableType =
  | 'library'
  | 'cli'
  | 'web-service'
  | 'ui'
  | 'data-pipeline'
  | 'other';

export type TestStrategy =
  | 'tdd'
  | 'lean-tdd'
  | 'integration'
  | 'state-verification'
  | 'property'
  | 'manual';

export type FeatureType = 'skeleton' | 'feature' | 'spike' | 'chore';

export type FeatureStatus = 'planned' | 'in_progress' | 'done' | 'blocked';

export type Severity = 'error' | 'warning' | 'info';

export interface DocSync {
  target: string;
  watch: readonly string[];
  severity: Severity;
}

export interface FeatureSpec {
  id: string;
  type: FeatureType;
  title: string;
  priority: number;
  status: FeatureStatus;
  test_strategy: TestStrategy;
  test_strategy_reason?: string;
  acceptance_criteria: readonly string[];
  tdd_focus?: readonly string[];
  depends_on?: readonly string[];
  modules?: readonly string[];
  doc_sync?: readonly DocSync[];
  sensitive?: boolean;
}

export interface TechStack {
  language: string;
  runtime: string;
  framework: string;
  testing: string;
}

export interface ArchitectureConstraint {
  pattern: string;
  reference?: string;
}

export interface QualityConstraint {
  coverage_threshold: number;
  required_gates: readonly number[];
  prototype_mode?: boolean;
}

export interface Constraints {
  tech_stack: TechStack;
  architecture: ArchitectureConstraint;
  quality: QualityConstraint;
}

export interface EntryPoint {
  name: string;
  command: string;
  build_command?: string;
  health_check?: unknown;
}

export interface SmokeScenario {
  id: string;
  description: string;
  steps: readonly string[];
  success_criteria: string;
}

export interface Deliverable {
  type: DeliverableType;
  entry_points: readonly EntryPoint[];
  smoke_scenarios: readonly SmokeScenario[];
}

export interface ProjectSection {
  name: string;
  version: string;
  summary?: string;
  description?: string;
}

export interface Spec {
  version: string;
  project: ProjectSection;
  domain: unknown;
  constraints: Constraints;
  deliverable: Deliverable;
  features: readonly FeatureSpec[];
  metadata?: unknown;
}

// ---------------------------------------------------------------------------
// 검증 보고 타입 — 각 규칙은 0 개 이상의 Finding 을 반환한다.
// ---------------------------------------------------------------------------

export type SpecRuleId =
  | 'spec/cycle'
  | 'spec/walking-skeleton'
  | 'spec/deliverable-completeness'
  | 'spec/sensitive-enforcement'
  | 'spec/strategy-required-fields'
  | 'spec/framework-required'
  | 'spec/module-similarity';

export interface SpecFinding {
  rule: SpecRuleId;
  severity: Severity;
  message: string;
  path?: string;
}

export interface SpecValidationReport {
  findings: readonly SpecFinding[];
}

export interface ParseSuccess {
  ok: true;
  data: unknown;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

export const SENSITIVE_NAME_PATTERN = /^(auth|payment|pii|hook|gate|audit)/i;
