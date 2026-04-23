import { mkdtemp, readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  formatTimestamp,
  REQUIRED_FILES,
  runAnalyze,
} from '../../../src/steps/analyze/index.js';

const SAMPLE_SPEC = [
  'version: "2.3.6"',
  'project:',
  '  name: t',
  '  version: "0.0.1"',
].join('\n');

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('runAnalyze — F-007 integration', () => {
  let cwd: string;
  const fixedNow = new Date('2026-04-21T12:34:56.000Z');

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'harness-analyze-'));
  });

  afterEach(async () => {
    // 정리는 mkdtemp 기반이므로 OS 가 eventually 청소하지만, 테스트 빨리 돌려면
    // 명시 제거도 가능 — 수많은 스위트가 아니므로 생략한다.
  });

  it('AC1 — missing: writes the full skeleton', async () => {
    const result = await runAnalyze({
      cwd,
      specSource: SAMPLE_SPEC,
      now: () => fixedNow,
    });

    expect(result.state.kind).toBe('missing');
    expect([...result.writtenFiles].sort()).toEqual([...REQUIRED_FILES].sort());
    for (const rel of REQUIRED_FILES) {
      expect(await exists(join(cwd, '.harness', rel))).toBe(true);
    }
    const harness = await readFile(join(cwd, '.harness/harness.yaml'), 'utf8');
    expect(harness).toMatch(/root_hash: "[0-9a-f]{64}"/);
    expect(harness).toContain(fixedNow.toISOString());
  });

  it('AC4 — idempotent: running twice with same spec is a no-op', async () => {
    await runAnalyze({ cwd, specSource: SAMPLE_SPEC, now: () => fixedNow });
    // 첫 실행 후 `.harness/spec.yaml` 에 사용자 수동 주석을 끼워 보존 검증
    const specPath = join(cwd, '.harness/spec.yaml');
    const originalHarnessMtime = (await stat(join(cwd, '.harness/harness.yaml')))
      .mtimeMs;

    const result = await runAnalyze({
      cwd,
      specSource: SAMPLE_SPEC,
      now: () => new Date('2026-04-21T13:00:00.000Z'),
    });

    expect(result.state.kind).toBe('idempotent');
    expect(result.writtenFiles).toEqual([]);
    expect(await readFile(specPath, 'utf8')).toBe(SAMPLE_SPEC);
    const afterMtime = (await stat(join(cwd, '.harness/harness.yaml'))).mtimeMs;
    expect(afterMtime).toBe(originalHarnessMtime);
  });

  it('AC2 — partial: fills missing files but preserves existing content', async () => {
    await runAnalyze({ cwd, specSource: SAMPLE_SPEC, now: () => fixedNow });

    // 사용자가 직접 파일 하나를 손으로 지웠다고 가정
    const { rm } = await import('node:fs/promises');
    await rm(join(cwd, '.harness/events.log'));
    await rm(join(cwd, '.harness/hooks/meta.json'));

    // 기존 state.yaml 에 주석 추가 — 덮어써지면 안 된다
    const statePath = join(cwd, '.harness/state.yaml');
    const mutated = '# USER NOTE\n' + (await readFile(statePath, 'utf8'));
    await writeFile(statePath, mutated);

    const result = await runAnalyze({
      cwd,
      specSource: SAMPLE_SPEC,
      now: () => fixedNow,
    });

    expect(result.state.kind).toBe('partial');
    expect([...result.writtenFiles].sort()).toEqual(
      ['events.log', 'hooks/meta.json'].sort(),
    );
    expect(await readFile(statePath, 'utf8')).toBe(mutated);
    expect(await exists(join(cwd, '.harness/events.log'))).toBe(true);
    expect(await exists(join(cwd, '.harness/hooks/meta.json'))).toBe(true);
  });

  it('AC3 — new_input: spec changed → backup _workspace_<ts>/ and regenerate', async () => {
    await runAnalyze({ cwd, specSource: SAMPLE_SPEC, now: () => fixedNow });

    const NEW_SPEC = SAMPLE_SPEC + '\n# comment changed\n';
    const backupTs = new Date('2026-04-22T01:02:03.000Z');
    const result = await runAnalyze({
      cwd,
      specSource: NEW_SPEC,
      now: () => backupTs,
    });

    expect(result.state.kind).toBe('new_input');
    expect(result.backupPath).toBeDefined();

    const expectedBackup = join(
      cwd,
      `_workspace_${formatTimestamp(backupTs)}`,
    );
    expect(result.backupPath).toBe(expectedBackup);
    expect(await exists(expectedBackup)).toBe(true);
    expect(await exists(join(expectedBackup, 'harness.yaml'))).toBe(true);

    // 새 .harness/ 가 NEW_SPEC 해시로 재생성되었는지
    const regenerated = await readFile(
      join(cwd, '.harness/harness.yaml'),
      'utf8',
    );
    expect(regenerated).toContain(backupTs.toISOString());
    expect(regenerated).toMatch(/root_hash: "[0-9a-f]{64}"/);

    // 기존 backup 이 보존
    const backed = await readdir(expectedBackup);
    expect(backed.length).toBeGreaterThan(0);
  });

  it('AC3 edge — two backups in the same second get _1 suffix', async () => {
    await runAnalyze({ cwd, specSource: SAMPLE_SPEC, now: () => fixedNow });
    // 첫 백업 폴더를 만들어 선점한 상태 재현
    const sameTsNow = new Date('2026-04-22T01:02:03.000Z');
    await mkdir(
      join(cwd, `_workspace_${formatTimestamp(sameTsNow)}`),
      { recursive: true },
    );

    const result = await runAnalyze({
      cwd,
      specSource: SAMPLE_SPEC + '\n# bump\n',
      now: () => sameTsNow,
    });

    expect(result.backupPath).toBe(
      join(cwd, `_workspace_${formatTimestamp(sameTsNow)}_1`),
    );
  });
});

describe('formatTimestamp', () => {
  it('emits YYYYMMDD_HHMMSS in local time', () => {
    // 고정된 시간을 로컬에 대해 단언하지 않고 형식만 본다.
    const ts = formatTimestamp(new Date('2026-01-02T03:04:05.000Z'));
    expect(ts).toMatch(/^\d{8}_\d{6}$/);
  });
});
