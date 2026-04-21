// harness-boot — new_input 상태에서 기존 `.harness/` 를 _workspace_<ts>/ 로
// 이동 후 새 스켈레톤 공간을 확보한다 (F-007).
//
// 타임스탬프는 주입되며(`opts.now`), 초 해상도(YYYYMMDD_HHMMSS) 를 쓴다.
// 동시 실행 등으로 같은 초에 두 번 호출될 수도 있어 숫자 suffix 로 충돌을 피한다.

import { access, rename } from 'node:fs/promises';
import { join } from 'node:path';

import { HARNESS_DIR } from './types.js';

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

export function formatTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}_` +
    `${pad(d.getHours(), 2)}${pad(d.getMinutes(), 2)}${pad(d.getSeconds(), 2)}`
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function backupExistingHarness(opts: {
  cwd: string;
  now: Date;
}): Promise<string> {
  const from = join(opts.cwd, HARNESS_DIR);
  const base = `_workspace_${formatTimestamp(opts.now)}`;
  let target = join(opts.cwd, base);
  let suffix = 1;
  while (await exists(target)) {
    target = join(opts.cwd, `${base}_${suffix}`);
    suffix += 1;
  }
  await rename(from, target);
  return target;
}
