// harness-boot — spec.yaml 의미 검증 진입점 (F-006)
//
// 6 개의 §5.1 규칙 + module 유사도 규칙을 순차 적용해 단일 보고서를 반환한다.
// 모든 규칙은 부작용이 없으며, 입력 타입이 어긋나면 가능한 한 조용히 스킵한다.

import {
  checkCycles,
  checkDeliverableCompleteness,
  checkFrameworkRequired,
  checkModuleSimilarity,
  checkRootShape,
  checkSensitiveEnforcement,
  checkStrategyRequiredFields,
  checkWalkingSkeleton,
} from './rules.js';
import type { SpecFinding, SpecValidationReport } from './types.js';

export function validateSpec(data: unknown): SpecValidationReport {
  const rootIssues = checkRootShape(data);
  if (rootIssues.length > 0) {
    return { findings: rootIssues };
  }
  const findings: SpecFinding[] = [
    ...checkWalkingSkeleton(data),
    ...checkCycles(data),
    ...checkDeliverableCompleteness(data),
    ...checkSensitiveEnforcement(data),
    ...checkStrategyRequiredFields(data),
    ...checkFrameworkRequired(data),
    ...checkModuleSimilarity(data),
  ];
  return { findings };
}

export function hasSpecErrors(report: SpecValidationReport): boolean {
  return report.findings.some((f) => f.severity === 'error');
}
