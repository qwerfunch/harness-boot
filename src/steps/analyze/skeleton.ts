// harness-boot — `.harness/` 스켈레톤 쓰기 (F-007)
//
// BR-001 덮어쓰기 금지 — 이미 존재하는 파일은 절대 수정하지 않는다.  new_input
// 플로우에서만 상위 레이어가 backup 을 먼저 호출해 이 규칙을 유지한다.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { sha256 } from './hash.js';
import { HARNESS_DIR, REQUIRED_FILES } from './types.js';

interface WriteSkeletonOpts {
  cwd: string;
  specSource: string;
  now: Date;
  onlyMissing?: ReadonlySet<string>; // partial 모드 — 해당 파일만 생성
}

export async function writeSkeleton(
  opts: WriteSkeletonOpts,
): Promise<string[]> {
  const harnessPath = join(opts.cwd, HARNESS_DIR);
  await mkdir(harnessPath, { recursive: true });

  const written: string[] = [];
  const shouldWrite = (rel: string): boolean =>
    opts.onlyMissing === undefined || opts.onlyMissing.has(rel);

  const target = async (rel: string): Promise<string> => {
    const abs = join(harnessPath, rel);
    await mkdir(dirname(abs), { recursive: true });
    return abs;
  };

  const hash = sha256(opts.specSource);
  const iso = opts.now.toISOString();

  if (shouldWrite('spec.yaml')) {
    await writeFile(await target('spec.yaml'), opts.specSource, {
      flag: 'wx',
    });
    written.push('spec.yaml');
  }

  if (shouldWrite('harness.yaml')) {
    const body = [
      '# harness-boot — generated meta. DO NOT EDIT (BR-001).',
      '# 이 파일은 /harness:analyze 가 spec.yaml 로부터 결정적으로 파생한다.',
      `version: "0.1.0"`,
      `generated_from:`,
      `  root_hash: "${hash}"`,
      `  generated_at: "${iso}"`,
      'runtime:',
      '  primary: claude-code',
      '',
    ].join('\n');
    await writeFile(await target('harness.yaml'), body, { flag: 'wx' });
    written.push('harness.yaml');
  }

  if (shouldWrite('state.yaml')) {
    const body = [
      '# harness-boot — gate · feature status 캐시. /harness:check 가 갱신.',
      'gates: {}',
      'features: {}',
      '',
    ].join('\n');
    await writeFile(await target('state.yaml'), body, { flag: 'wx' });
    written.push('state.yaml');
  }

  if (shouldWrite('events.log')) {
    await writeFile(await target('events.log'), '', { flag: 'wx' });
    written.push('events.log');
  }

  if (shouldWrite('hooks/meta.json')) {
    const body =
      JSON.stringify(
        {
          hooks: {},
          allowedEnvVars: [],
        },
        null,
        2,
      ) + '\n';
    await writeFile(await target('hooks/meta.json'), body, { flag: 'wx' });
    written.push('hooks/meta.json');
  }

  return written;
}

export { REQUIRED_FILES };
