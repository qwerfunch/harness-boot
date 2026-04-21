// harness-boot — CLI 진입점 (F-007)
//
// `bin/harness-boot` 가 dispatch 하는 엔트리.  현재 지원 명령:
//   - version     (F-001)
//   - analyze     (F-007)  + --dry-run
// 나머지 /harness:* 스텝은 F-008 ~ F-012 에서 순차적으로 add.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runAnalyze } from './steps/analyze/index.js';
import { detectState } from './steps/analyze/detect.js';

export interface CliIO {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const defaultIO: CliIO = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
};

export async function runCli(
  argv: readonly string[],
  io: CliIO = defaultIO,
): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'analyze':
      return runAnalyzeCli(rest, io);
    default:
      io.stderr(
        `harness-boot: CLI 라이브러리 모듈이 알 수 없는 명령을 받았다 '${String(
          cmd,
        )}'.\n`,
      );
      return 2;
  }
}

async function runAnalyzeCli(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  const dryRun = args.includes('--dry-run');
  const cwd = process.cwd();
  const specPath = resolve(cwd, 'spec.yaml');

  let specSource: string;
  try {
    specSource = await readFile(specPath, 'utf8');
  } catch {
    io.stderr(
      `harness-boot analyze: 루트에 spec.yaml 이 필요하다.\n` +
        `  찾은 위치: ${specPath}\n` +
        `  조치: \`/harness:spec\` 로 최초 spec.yaml 을 생성하거나 수동 배치.\n`,
    );
    return 2;
  }

  if (dryRun) {
    const state = await detectState({ cwd, specSource });
    io.stdout(
      `analyze[dry-run] state=${state.kind}` +
        (state.kind === 'partial'
          ? ` missing=[${state.missingFiles.join(', ')}]`
          : '') +
        (state.kind === 'new_input'
          ? ` hash=${state.currentHash.slice(0, 12)}...`
          : '') +
        '\n',
    );
    return 0;
  }

  const result = await runAnalyze({ cwd, specSource });
  io.stdout(`analyze state=${result.state.kind}\n`);
  if (result.backupPath) {
    io.stdout(`  backup → ${result.backupPath}\n`);
  }
  for (const f of result.writtenFiles) {
    io.stdout(`  wrote .harness/${f}\n`);
  }
  return 0;
}
