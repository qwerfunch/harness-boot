/**
 * Kickoff ceremony template generator (F-097 port of
 * `scripts/ceremonies/kickoff.py`).
 *
 * Generates `.harness/_workspace/kickoff/F-N.md` with per-role
 * headings for the agents matched by the feature shape. Python-side
 * template only — orchestrator fills each heading via prose-contract
 * invocations.
 *
 * Idempotency contract (v0.8.2): existing kickoff files are not
 * overwritten unless `force=true`.
 *
 * @module ceremonies/kickoff
 */

import {appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {parse as yamlParse} from 'yaml';

import {PARALLEL_GROUPS, ROUTING_SHAPES} from '../core/routing.js';

/** Optional input for {@link generateKickoff}. */
export interface GenerateKickoffOptions {
  hasAudio?: boolean;
  timestamp?: string;
  force?: boolean;
  mode?: 'product' | 'prototype';
  styleBlock?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Returns true when a feature declares ui_surface.has_audio = true. */
export function hasAudioFlag(feature: unknown): boolean {
  if (!isPlainObject(feature)) {
    return false;
  }
  const ui = feature['ui_surface'];
  if (!isPlainObject(ui)) {
    return false;
  }
  return Boolean(ui['has_audio']);
}

/**
 * Returns true when the feature text or modules reference any
 * `domain.entities[].name` whose `sensitive` flag is true.
 */
function touchesSensitiveEntity(feature: unknown, spec: unknown): boolean {
  if (!isPlainObject(spec) || !isPlainObject(feature)) {
    return false;
  }
  const domain = isPlainObject(spec['domain']) ? (spec['domain'] as Record<string, unknown>) : {};
  const entities = asArray(domain['entities']);
  const sensitiveNames: string[] = [];
  for (const e of entities) {
    if (isPlainObject(e) && e['sensitive'] === true) {
      const name = e['name'];
      if (typeof name === 'string' && name.length > 0) {
        sensitiveNames.push(name.toLowerCase());
      }
    }
  }
  if (sensitiveNames.length === 0) {
    return false;
  }
  const parts: string[] = [];
  if (typeof feature['title'] === 'string') {
    parts.push(feature['title']);
  }
  for (const m of asArray(feature['modules'])) {
    if (typeof m === 'string') {
      parts.push(m);
    }
  }
  for (const ac of asArray(feature['acceptance_criteria'])) {
    if (typeof ac === 'string') {
      parts.push(ac);
    }
  }
  const haystack = parts.join(' ').toLowerCase();
  return sensitiveNames.some((name) => haystack.includes(name));
}

/**
 * Maps a feature dict to its routing shape list.
 *
 * Heuristic order:
 *
 *   1. Empty title + AC + modules → `['baseline-empty-vague']`.
 *   2. Otherwise accumulate `ui_surface.present`, `performance_budget`,
 *      `sensitive_or_auth`.
 *   3. No specialist shape → `pure_domain_logic`.
 *   4. Always append `feature_completion`.
 */
export function detectShapes(feature: unknown, spec: unknown = null): string[] {
  if (!isPlainObject(feature)) {
    return [];
  }
  const title = typeof feature['title'] === 'string' ? feature['title'].trim() : '';
  const ac = asArray(feature['acceptance_criteria']);
  const modules = asArray(feature['modules']);

  if (title.length === 0 && ac.length === 0 && modules.length === 0) {
    return ['baseline-empty-vague'];
  }

  const shapes: string[] = [];
  const ui = isPlainObject(feature['ui_surface']) ? (feature['ui_surface'] as Record<string, unknown>) : {};
  if (ui['present'] === true) {
    shapes.push('ui_surface.present');
  }
  if (feature['performance_budget'] !== undefined && feature['performance_budget'] !== null) {
    shapes.push('performance_budget');
  }
  if (feature['sensitive'] === true) {
    shapes.push('sensitive_or_auth');
  } else if (touchesSensitiveEntity(feature, spec)) {
    shapes.push('sensitive_or_auth');
  }
  if (shapes.length === 0) {
    shapes.push('pure_domain_logic');
  }
  shapes.push('feature_completion');
  return shapes;
}

/**
 * Resolves a shape list to a deduped, order-preserved agent list.
 * When `hasAudio` is true, audio-designer slots in immediately
 * before a11y-auditor (matches the design-review reviewer ordering).
 */
export function agentsForShapes(
  shapes: ReadonlyArray<string>,
  hasAudio: boolean = false,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const shape of shapes) {
    const agents = ROUTING_SHAPES[shape] ?? [];
    for (const agent of agents) {
      if (!seen.has(agent)) {
        seen.add(agent);
        out.push(agent);
      }
    }
    if (shape === 'ui_surface.present' && hasAudio && !seen.has('audio-designer')) {
      seen.add('audio-designer');
      const idx = out.indexOf('a11y-auditor');
      if (idx === -1) {
        out.push('audio-designer');
      } else {
        out.splice(idx, 0, 'audio-designer');
      }
    }
  }
  return out;
}

/**
 * F-039 — collects parallel-capable agent groups for the given shape
 * list. Filters audio-designer when has_audio is false and drops
 * groups with fewer than two members.
 */
export function parallelGroupsForShapes(
  shapes: ReadonlyArray<string>,
  hasAudio: boolean = false,
): string[][] {
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const shape of shapes) {
    const candidates = PARALLEL_GROUPS[shape] ?? [];
    for (const group of candidates) {
      const members = group.filter((m) => hasAudio || m !== 'audio-designer');
      if (members.length < 2) {
        continue;
      }
      const key = members.join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      groups.push([...members]);
    }
  }
  return groups;
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

function rstrip(s: string): string {
  return s.replace(/\s+$/, '');
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
  throw new TypeError(`kickoff: unsupported value type ${typeof value}.`);
}

function appendEvent(harnessDir: string, event: Record<string, unknown>): void {
  const logPath = join(harnessDir, 'events.log');
  mkdirSync(dirname(logPath), {recursive: true});
  appendFileSync(logPath, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}

/**
 * F-037 — builds the "기존 스타일 컨텍스트" section from the area
 * index. Returns an empty string when there is no overlap or when
 * `area_index.yaml` is absent.
 */
export function renderStyleBlock(harnessDir: string, feature: unknown): string {
  const indexPath = join(harnessDir, 'area_index.yaml');
  if (!isFile(indexPath)) {
    return '';
  }
  let loaded: unknown;
  try {
    loaded = yamlParse(readFileSync(indexPath, 'utf-8'));
  } catch {
    return '';
  }
  const areas = isPlainObject(loaded) ? asArray(loaded['areas']) : [];
  if (!isPlainObject(feature)) {
    return '';
  }
  const featureModules = new Set<string>();
  for (const m of asArray(feature['modules'])) {
    if (typeof m === 'string') {
      featureModules.add(m);
    }
  }
  if (featureModules.size === 0) {
    return '';
  }
  const matched: Record<string, unknown>[] = [];
  for (const entry of areas) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const entryModules = new Set<string>();
    for (const m of asArray(entry['modules'])) {
      if (typeof m === 'string') {
        entryModules.add(m);
      }
    }
    for (const m of entryModules) {
      if (featureModules.has(m)) {
        matched.push(entry);
        break;
      }
    }
  }
  if (matched.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## 기존 스타일 컨텍스트 (auto · F-037)');
  lines.push('');
  lines.push(
    '> 어둠이 걷힌 영역. 아래 chapter 가 implementer / software-engineer / frontend-engineer 의 기본 컨텍스트.',
  );
  lines.push('');
  lines.push('### 관련 area chapter');
  for (const entry of matched) {
    const label = (entry['label'] as string) ?? (entry['slug'] as string) ?? 'area';
    const chapterPath = (entry['chapter_path'] as string) ?? '';
    lines.push(`- [${label}](../../${chapterPath})`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function template(
  featureId: string,
  agents: ReadonlyArray<string>,
  timestamp: string,
  mode: 'product' | 'prototype',
  styleBlock: string,
): string {
  const isPrototype = mode === 'prototype';
  const bulletsPerAgent = isPrototype ? 1 : 3;
  const guidance = isPrototype
    ? '이 agent 의 관점에서 가장 큰 우려 1 줄.'
    : '이 agent 의 Tier anchor 기반 3-bullet 우려 · 80 단어 이내';
  const intro = isPrototype
    ? '프로토타입 모드 — 각 agent 가 1 줄씩만 우려를 적는다.'
    : 'orchestrator 가 각 agent 를 소환해 섹션을 채운다 (80 단어 내 3 bullet). cross-role empathy 용.';

  const lines: string[] = [];
  lines.push(`# Kickoff — ${featureId}`);
  lines.push('');
  lines.push(`> 자동 생성 — ${timestamp} · mode: \`${mode}\``);
  lines.push('>');
  lines.push(`> \`scripts/kickoff.py\` 가 이 템플릿을 만들고, ${intro}`);
  lines.push('');
  lines.push(`## 참여 에이전트 (${agents.length})`);
  lines.push('');
  for (const a of agents) {
    lines.push(`- \`@harness:${a}\``);
  }
  lines.push('');
  if (styleBlock) {
    lines.push(rstrip(styleBlock));
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  for (const agent of agents) {
    lines.push(`## ${agent} 의 관점`);
    lines.push('');
    lines.push(`<!-- orchestrator: ${guidance} -->`);
    lines.push('');
    for (let i = 0; i < bulletsPerAgent; i++) {
      lines.push('- ');
    }
    lines.push('');
  }
  return `${rstrip(lines.join('\n'))}\n`;
}

/**
 * Generates the kickoff template + event for a feature.
 *
 * Idempotency: when the kickoff file already exists, the function
 * returns the existing path without writing or emitting an event
 * (unless `force=true`).
 */
export function generateKickoff(
  harnessDir: string,
  featureId: string,
  shapes: ReadonlyArray<string>,
  options: GenerateKickoffOptions = {},
): string {
  const hasAudio = options.hasAudio ?? false;
  const timestamp = options.timestamp ?? nowIso();
  const force = options.force ?? false;
  const mode = options.mode ?? 'product';
  const styleBlock = options.styleBlock ?? '';

  const agents = agentsForShapes(shapes, hasAudio);
  if (agents.length === 0) {
    throw new Error(
      `no agents matched for shapes=${JSON.stringify([...shapes])}; check ROUTING_SHAPES`,
    );
  }

  const kickoffDir = join(harnessDir, '_workspace', 'kickoff');
  mkdirSync(kickoffDir, {recursive: true});
  const kickoffPath = join(kickoffDir, `${featureId}.md`);

  if (isFile(kickoffPath) && !force) {
    return kickoffPath;
  }

  writeFileSync(kickoffPath, template(featureId, agents, timestamp, mode, styleBlock), 'utf-8');
  appendEvent(harnessDir, {
    ts: timestamp,
    type: 'kickoff_started',
    feature: featureId,
    shapes: [...shapes],
    agents,
    mode,
    path: relative(harnessDir, kickoffPath),
  });
  return kickoffPath;
}
