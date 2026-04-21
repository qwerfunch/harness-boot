// harness-boot — /harness:analyze 오케스트레이터 (F-007)
//
// 4-way 분기: missing · partial · new_input · idempotent.
// - missing       : 빈 스켈레톤 생성
// - partial       : 누락분만 채움 (BR-001 덮어쓰기 금지)
// - new_input     : 기존 `.harness/` 를 `_workspace_<ts>/` 로 백업, 재생성
// - idempotent    : no-op (AC4)

import { backupExistingHarness } from './backup.js';
import { detectState } from './detect.js';
import { writeSkeleton } from './skeleton.js';
import {
  type AnalyzeOptions,
  type AnalyzeResult,
} from './types.js';

export async function runAnalyze(
  opts: AnalyzeOptions,
): Promise<AnalyzeResult> {
  const now = (opts.now ?? (() => new Date()))();
  const state = await detectState(opts);

  if (state.kind === 'idempotent') {
    return { state, writtenFiles: [] };
  }

  if (state.kind === 'missing') {
    const written = await writeSkeleton({
      cwd: opts.cwd,
      specSource: opts.specSource,
      now,
    });
    return { state, writtenFiles: written };
  }

  if (state.kind === 'partial') {
    const written = await writeSkeleton({
      cwd: opts.cwd,
      specSource: opts.specSource,
      now,
      onlyMissing: new Set(state.missingFiles),
    });
    return { state, writtenFiles: written };
  }

  // new_input — 백업 후 재생성
  const backupPath = await backupExistingHarness({ cwd: opts.cwd, now });
  const written = await writeSkeleton({
    cwd: opts.cwd,
    specSource: opts.specSource,
    now,
  });
  return { state, writtenFiles: written, backupPath };
}

export { detectState } from './detect.js';
export { writeSkeleton } from './skeleton.js';
export { backupExistingHarness, formatTimestamp } from './backup.js';
export * from './types.js';
