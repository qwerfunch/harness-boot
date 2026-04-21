// harness-boot — CLI 진입점 (F-007 · F-008)
//
// `bin/harness-boot` 가 dispatch 하는 엔트리.  현재 지원 명령:
//   - version     (F-001)
//   - analyze     (F-007)  + --dry-run
//   - spec        (F-008)  + --mode=A|B|R|E (기본 A)
// 나머지 /harness:* 스텝은 F-009 ~ F-012 에서 순차적으로 add.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as readline from 'node:readline/promises';

import { runAnalyze } from './steps/analyze/index.js';
import { detectState } from './steps/analyze/detect.js';
import { runSpec } from './steps/spec/index.js';
import type { AskFn } from './steps/spec/index.js';
import type { SpecMode } from './steps/spec/types.js';

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
    case 'spec':
      return runSpecCli(rest, io);
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

function parseMode(args: readonly string[]): SpecMode | { error: string } {
  for (const a of args) {
    const m = /^--mode=([ABRE])$/i.exec(a);
    if (m) return m[1]!.toUpperCase() as SpecMode;
    if (a === '--mode') {
      return { error: '--mode 는 값이 필요합니다 (--mode=A|B|R|E).' };
    }
    if (a.startsWith('--mode=')) {
      return { error: `잘못된 모드: '${a.slice(7)}'. 허용: A · B · R · E.` };
    }
  }
  return 'A';
}

function makeReadlineAsker(): { ask: AskFn; close: () => void } {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask: AskFn = async (prompt) => {
    const suffix = prompt.default !== undefined ? ` [${prompt.default}]` : '';
    const raw = await rl.question(`${prompt.question}${suffix}\n> `);
    return raw;
  };
  return { ask, close: () => rl.close() };
}

async function runSpecCli(args: readonly string[], io: CliIO): Promise<number> {
  const modeResult = parseMode(args);
  if (typeof modeResult === 'object') {
    io.stderr(`harness-boot spec: ${modeResult.error}\n`);
    return 2;
  }
  const mode = modeResult;

  const cwd = process.cwd();
  const specPath = resolve(cwd, 'spec.yaml');

  let source = '';
  try {
    source = await readFile(specPath, 'utf8');
  } catch (err: unknown) {
    // 최초 실행 — spec.yaml 이 아직 없다.  빈 source 로 시작해 신규 작성.
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'ENOENT') {
      io.stderr(
        `harness-boot spec: spec.yaml 을 읽을 수 없다 (${specPath}).\n` +
          `  원인: ${(err as Error).message}\n`,
      );
      return 2;
    }
  }

  const { ask, close } = makeReadlineAsker();
  try {
    const result = await runSpec({ source, mode, ask });
    await writeFile(specPath, result.yaml, 'utf8');
    io.stdout(
      `spec mode=${result.mode} autofilled=${
        Object.keys(result.autofills).length
      } asked=${result.promptsAsked} → ${specPath}\n`,
    );
    return 0;
  } finally {
    close();
  }
}
