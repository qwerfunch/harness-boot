/**
 * Retrospective ceremony template generator (F-097 port of
 * `scripts/ceremonies/retro.py`).
 *
 * Fires after `/harness:work F-N --complete` succeeds. Reads
 * `events.log`, fills the machine-extractable sections (What
 * Shipped, First Gate to Fail, Ceremonies summary), and leaves the
 * LLM-driven sections as `_(pending)_` for orchestrator's reviewer →
 * tech-writer chain.
 *
 * Idempotency contract (v0.8.7): existing retro files are not
 * overwritten unless `force=true`.
 *
 * @module ceremonies/retro
 */

import {appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';

/** One row from events.log after parsing. */
type EventRecord = Record<string, unknown>;

/** Machine-extractable retro analysis. */
export interface RetroAnalysis {
  completed: boolean;
  first_gate_fail: EventRecord | null;
  kickoff_opened: boolean;
  design_review_opened: boolean;
  questions_opened: number;
  questions_answered: number;
  gate_events_total: number;
  all_events_total: number;
  archived: boolean;
  archived_event: EventRecord | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readEvents(harnessDir: string): EventRecord[] {
  const logPath = join(harnessDir, 'events.log');
  let raw: string;
  try {
    raw = readFileSync(logPath, 'utf-8');
  } catch {
    return [];
  }
  const out: EventRecord[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isPlainObject(parsed)) {
        out.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Extracts machine-readable retro data from a list of events for a
 * single feature.
 *
 * Event-key contract (matches `scripts/work.py`):
 *   - feature id key is `feature` (not `feature_id`)
 *   - completion type is `feature_done` (not `feature_completed`)
 *   - archive type is `feature_archived`
 */
export function analyze(events: ReadonlyArray<EventRecord>, featureId: string): RetroAnalysis {
  const relevant = events.filter((e) => e['feature'] === featureId);
  const gateEvents = relevant.filter((e) => e['type'] === 'gate_recorded');
  let firstGateFail: EventRecord | null = null;
  for (const e of gateEvents) {
    if (e['result'] === 'fail') {
      firstGateFail = e;
      break;
    }
  }
  const completed = relevant.some((e) => e['type'] === 'feature_done');
  const kickoffOpened = relevant.some((e) => e['type'] === 'kickoff_started');
  const designReviewOpened = relevant.some((e) => e['type'] === 'design_review_opened');
  const questionsOpened = relevant.filter((e) => e['type'] === 'question_opened').length;
  const questionsAnswered = relevant.filter((e) => e['type'] === 'question_answered').length;
  let archivedEvent: EventRecord | null = null;
  for (const e of relevant) {
    if (e['type'] === 'feature_archived') {
      archivedEvent = e;
    }
  }
  return {
    completed,
    first_gate_fail: firstGateFail,
    kickoff_opened: kickoffOpened,
    design_review_opened: designReviewOpened,
    questions_opened: questionsOpened,
    questions_answered: questionsAnswered,
    gate_events_total: gateEvents.length,
    all_events_total: relevant.length,
    archived: archivedEvent !== null,
    archived_event: archivedEvent,
  };
}

function rstrip(s: string): string {
  return s.replace(/\s+$/, '');
}

function nowIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function pythonStyleJsonStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => pythonStyleJsonStringify(v)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const pairs = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`,
    );
    return `{${pairs.join(', ')}}`;
  }
  throw new TypeError(`retro: unsupported value type ${typeof value}.`);
}

function appendEvent(harnessDir: string, event: Record<string, unknown>): void {
  const logPath = join(harnessDir, 'events.log');
  mkdirSync(dirname(logPath), {recursive: true});
  appendFileSync(logPath, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}

function template(
  featureId: string,
  analysis: RetroAnalysis,
  timestamp: string,
  mode: 'product' | 'prototype',
): string {
  const isPrototype = mode === 'prototype';
  const fgf = analysis.first_gate_fail;
  const fgfLine =
    fgf !== null
      ? `- ${(fgf['gate'] as string | undefined) ?? '?'} failed at ${(fgf['ts'] as string | undefined) ?? '?'}` +
        `  (reason: ${(fgf['note'] as string | undefined) || (fgf['reason'] as string | undefined) || '?'})`
      : '- 없음 (전 gate 최초에 pass)';

  const intro = isPrototype
    ? '프로토타입 모드 — 머신 섹션만 자동 채움. LLM 반성 섹션은 생략.'
    : '`scripts/retro.py` 가 events.log 를 분석해 머신 섹션을 채우고, ' +
      'orchestrator 가 reviewer → tech-writer 순차로 Reviewer Reflection · ' +
      'Copy Polish 섹션을 완성한다.';

  const lines: string[] = [];
  lines.push(`# Retrospective — ${featureId}`);
  lines.push('');
  lines.push(`> 자동 생성 — ${timestamp} · mode: \`${mode}\``);
  lines.push('>');
  lines.push(`> ${intro}`);
  lines.push('');

  // What Shipped
  lines.push('## What Shipped');
  lines.push('');
  if (analysis.completed) {
    lines.push(`- ${featureId} — complete 전이 감지.`);
  } else {
    lines.push(`- ${featureId} — complete 이벤트 미감지. 수동 확인 필요.`);
  }
  lines.push('');

  // Superseded By — v0.10
  if (analysis.archived) {
    const ev = analysis.archived_event ?? {};
    const sb = ev['superseded_by'];
    const reason = (ev['reason'] as string | undefined) ?? '(reason 미기록)';
    const ts = (ev['ts'] as string | undefined) ?? '?';
    lines.push('## Superseded By');
    lines.push('');
    if (typeof sb === 'string' && sb.length > 0) {
      lines.push(`- 이 피처는 **${sb}** 로 대체됨 (${ts})`);
    } else {
      lines.push(
        `- 이 피처는 archived 됨 (${ts}) — superseded_by 미지정 (deprecation only · 대체 피처 없음)`,
      );
    }
    lines.push(`- 사유: ${reason}`);
    lines.push('');
    lines.push(
      '<!-- F-028: feature_archived event 의 superseded_by/reason 자동 채움. 수동 추가 컨텍스트는 아래에 자유 기술. -->',
    );
    lines.push('');
  }

  // First Gate to Fail
  lines.push('## First Gate to Fail');
  lines.push('');
  lines.push(fgfLine);
  lines.push('');

  // Ceremonies
  lines.push('## Ceremonies');
  lines.push('');
  lines.push(`- Kickoff opened: ${analysis.kickoff_opened ? '✅' : '❌'}`);
  lines.push(
    `- Design Review opened: ${
      analysis.design_review_opened ? '✅' : '❌ (해당 피처에 미실행)'
    }`,
  );
  lines.push(
    `- Questions opened: ${analysis.questions_opened} · answered: ${analysis.questions_answered}`,
  );
  lines.push('');

  if (isPrototype) {
    return `${rstrip(lines.join('\n'))}\n`;
  }

  // LLM sections — left as pending placeholders.
  for (const heading of [
    'Risks Materialized vs plan.md',
    'Decisions Revised',
    'Kickoff Predictions That Were Right / Wrong',
  ]) {
    lines.push(`## ${heading}`);
    lines.push('');
    lines.push(`<!-- orchestrator via reviewer: ${heading} 섹션 -->`);
    lines.push('');
    lines.push('_(pending)_');
    lines.push('');
  }

  lines.push('## Reviewer Reflection');
  lines.push('');
  lines.push(
    '<!-- orchestrator invokes @harness:reviewer to produce draft prose. ' +
      'reviewer 는 read-only (CQS) — draft 텍스트만 반환. orchestrator 가 이 섹션에 write. -->',
  );
  lines.push('');
  lines.push('_(pending)_');
  lines.push('');

  lines.push('## Copy Polish');
  lines.push('');
  lines.push(
    '<!-- orchestrator invokes @harness:tech-writer to polish the Reviewer Reflection. ' +
      'tech-writer 가 Write/Edit 으로 직접 이 섹션을 다듬음. -->',
  );
  lines.push('');
  lines.push('_(pending)_');
  lines.push('');

  return `${rstrip(lines.join('\n'))}\n`;
}

/** Optional input for {@link generateRetro}. */
export interface GenerateRetroOptions {
  timestamp?: string;
  force?: boolean;
  mode?: 'product' | 'prototype';
}

/**
 * Generates `.harness/_workspace/retro/F-N.md` plus a
 * `feature_retro_written` event. Idempotent — existing retro files
 * are preserved unless `force=true`.
 */
export function generateRetro(
  harnessDir: string,
  featureId: string,
  options: GenerateRetroOptions = {},
): string {
  const timestamp = options.timestamp ?? nowIso();
  const force = options.force ?? false;
  const mode = options.mode ?? 'product';

  const retroDir = join(harnessDir, '_workspace', 'retro');
  mkdirSync(retroDir, {recursive: true});
  const path = join(retroDir, `${featureId}.md`);

  if (isFile(path) && !force) {
    return path;
  }

  const events = readEvents(harnessDir);
  const analysis = analyze(events, featureId);
  writeFileSync(path, template(featureId, analysis, timestamp, mode), 'utf-8');
  appendEvent(harnessDir, {
    ts: timestamp,
    type: 'feature_retro_written',
    feature: featureId,
    mode,
    analysis_summary: {
      completed: analysis.completed,
      first_gate_fail:
        analysis.first_gate_fail !== null ? analysis.first_gate_fail['gate'] : null,
      questions_opened: analysis.questions_opened,
    },
    path: relative(harnessDir, path),
  });
  return path;
}
