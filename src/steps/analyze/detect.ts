// harness-boot — `.harness/` 상태 탐지 (F-007)
//
// 순수 비쓰기 검사.  파일 존재 · 해시 비교만으로 네 상태 중 하나를 결정한다.

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { sha256 } from './hash.js';
import {
  type AnalyzeState,
  HARNESS_DIR,
  REQUIRED_FILES,
} from './types.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPreviousHash(
  harnessPath: string,
): Promise<string | undefined> {
  try {
    const source = await readFile(join(harnessPath, 'harness.yaml'), 'utf8');
    const parsed = parseYaml(source) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const gen = (parsed as Record<string, unknown>)['generated_from'];
      if (gen && typeof gen === 'object' && !Array.isArray(gen)) {
        const h = (gen as Record<string, unknown>)['root_hash'];
        if (typeof h === 'string' && h.length > 0) return h;
      }
    }
  } catch {
    // fall through — harness.yaml 이 없거나 파싱 불가능 → undefined
  }
  return undefined;
}

export async function detectState(opts: {
  cwd: string;
  specSource: string;
}): Promise<AnalyzeState> {
  const harnessPath = join(opts.cwd, HARNESS_DIR);
  const currentHash = sha256(opts.specSource);

  if (!(await exists(harnessPath))) {
    return { kind: 'missing' };
  }

  const checks = await Promise.all(
    REQUIRED_FILES.map(async (rel) => ({
      rel,
      present: await exists(join(harnessPath, rel)),
    })),
  );
  const missingFiles = checks.filter((c) => !c.present).map((c) => c.rel);

  if (missingFiles.length > 0) {
    return { kind: 'partial', missingFiles };
  }

  const previousHash = await readPreviousHash(harnessPath);
  if (previousHash !== currentHash) {
    return {
      kind: 'new_input',
      previousHash,
      currentHash,
    };
  }
  return { kind: 'idempotent', hash: currentHash };
}
