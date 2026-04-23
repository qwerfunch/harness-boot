// harness-boot — /harness:spec 오케스트레이터 (F-008)
//
// 책임:
//   1. spec.yaml (또는 주어진 source) 을 파싱해 현재 상태 확보
//   2. Mode A/B/R/E 로 SpecModePlan 계산
//   3. injectAsk 로 대화 진행 (테스트는 답 큐를 고정)
//   4. 최종 materialize 결과를 YAML 로 직렬화해 반환
//
// 파일 쓰기는 호출자(CLI) 책임 — BR-001 wx 보장은 cli 계층에서 수행.

import { parseSpecYaml } from '../../core/spec/parse.js';
import { stringify as stringifyYaml } from 'yaml';
import { planMode } from './modes.js';
import {
  applyAnswer,
  isDone,
  materialize,
  nextPrompt,
  startProgress,
} from './prompts.js';
import type { SpecMode, SpecPrompt } from './types.js';

export type AskFn = (prompt: SpecPrompt) => Promise<string>;

export interface RunSpecInput {
  source: string;            // 기존 spec.yaml 의 텍스트 (빈 문자열 허용)
  mode: SpecMode;
  ask: AskFn;                // 대화 I/O 주입 — CLI 는 readline, 테스트는 배열
}

export interface RunSpecResult {
  mode: SpecMode;
  autofills: Record<string, string>;
  answers: Record<string, string>;
  /** 최종 채워진 spec 의 YAML 직렬화 결과. */
  yaml: string;
  /** 물은 prompt 수 (진행 가시성 · 로깅용). */
  promptsAsked: number;
}

export async function runSpec(input: RunSpecInput): Promise<RunSpecResult> {
  const current = loadCurrent(input.source);
  const plan = planMode({ current, mode: input.mode });

  let progress = startProgress(plan);
  let asked = 0;
  while (!isDone(progress)) {
    const q = nextPrompt(progress);
    if (!q) break;
    const answer = await input.ask(q);
    asked += 1;
    progress = applyAnswer(progress, answer);
  }

  const base = isPlainRecord(current) ? current : {};
  const merged = materialize(base, progress);
  const yaml = stringifyYaml(merged);

  return {
    mode: input.mode,
    autofills: progress.autofills,
    answers: progress.answers,
    yaml,
    promptsAsked: asked,
  };
}

function loadCurrent(source: string): Record<string, unknown> {
  if (source.trim() === '') return {};
  const parsed = parseSpecYaml(source);
  if (!parsed.ok) {
    throw new Error(`spec 파싱 실패: ${parsed.error}`);
  }
  return isPlainRecord(parsed.data) ? parsed.data : {};
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export { planMode } from './modes.js';
export {
  applyAnswer,
  isDone,
  materialize,
  nextPrompt,
  startProgress,
} from './prompts.js';
export { SPEC_FIELDS } from './fields.js';
export { getPath, isEmpty, setPath } from './path.js';
export type {
  PlanInput,
  PromptKind,
  SpecMode,
  SpecModePlan,
  SpecPrompt,
} from './types.js';
