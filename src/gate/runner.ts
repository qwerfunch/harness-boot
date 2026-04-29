/**
 * Gate auto-detection + subprocess execution (F-095 port of
 * `scripts/gate/runner.py`).
 *
 * The dispatcher decides what command to run for each of the six
 * standard gates plus the optional `gate_perf`, then spawns it under
 * a timeout and packages the result. work.ts depends on this for
 * `runGate(name, projectRoot, options)` invocations.
 *
 * Override resolution priority — same as Python:
 *
 *   1. `--override-command` (caller-supplied)
 *   2. `harness.yaml.gate_commands.<gate>` (per-project pin)
 *   3. Auto-detect (this module's `detectGate*Command` helpers)
 *
 * @module gate/runner
 */

import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {delimiter as pathDelimiter, join, sep as pathSep} from 'node:path';
import {parse as yamlParse} from 'yaml';

/** Permitted gate result values. */
export type GateResult = 'pass' | 'fail' | 'skipped';

/** Outcome of a gate run, including subprocess metadata for diagnostics. */
export interface GateRunResult {
  gate: string;
  result: GateResult;
  reason: string;
  command: string[];
  exitCode: number | null;
  stdoutTail: string;
  stderrTail: string;
  durationSec: number;
}

/** Optional input shared by every `runGate*` entry point. */
export interface RunGateOptions {
  overrideCommand?: ReadonlyArray<string> | null;
  harnessDir?: string | null;
  timeoutSec?: number;
}

const DEFAULT_TIMEOUT_SEC = 300;

/** Returns the absolute path of `bin` if it exists somewhere on `PATH`. */
function which(bin: string): string | null {
  const pathEnv = process.env['PATH'] ?? '';
  for (const entry of pathEnv.split(pathDelimiter)) {
    if (entry.length === 0) {
      continue;
    }
    const candidate = join(entry, bin);
    try {
      const stat = statSync(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Returns true iff `path` exists and is a regular file. */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Returns true iff `path` exists and is a directory. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Mirrors Python's `_tail` — last `nLines` lines, with elision marker. */
function tail(text: string, nLines: number = 30): string {
  if (!text) {
    return '';
  }
  const lines = text.split('\n');
  if (lines.length <= nLines) {
    return lines.join('\n');
  }
  return ['... (earlier output elided)', ...lines.slice(-nLines)].join('\n');
}

/** Returns a runnable pytest invocation, or null when pytest is missing. */
function pytestCommand(): string[] | null {
  if (which('pytest') !== null) {
    return ['pytest'];
  }
  // python -m pytest --version probe (covers user-site / venv installs).
  for (const py of ['python3', 'python']) {
    if (which(py) === null) {
      continue;
    }
    try {
      const probe = spawnSync(py, ['-m', 'pytest', '--version'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      if (probe.status === 0) {
        return [py, '-m', 'pytest'];
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Maps a `package.json scripts.<name>` entry to an `npm` invocation. */
function npmScriptCommand(projectRoot: string, scriptName: string): string[] | null {
  const pkg = join(projectRoot, 'package.json');
  if (!isFile(pkg)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(pkg, 'utf-8'));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const scripts = (parsed as Record<string, unknown>)['scripts'];
  if (
    scripts === null ||
    typeof scripts !== 'object' ||
    Array.isArray(scripts) ||
    !(scriptName in (scripts as Record<string, unknown>))
  ) {
    return null;
  }
  if (which('npm') === null) {
    return null;
  }
  if (scriptName === 'test') {
    return ['npm', 'test'];
  }
  return ['npm', 'run', scriptName];
}

/** Auto-detection for gate_0 (tests). */
export function detectGate0Command(projectRoot: string): string[] | null {
  const pyproject = join(projectRoot, 'pyproject.toml');
  if (isFile(pyproject)) {
    try {
      const text = readFileSync(pyproject, 'utf-8');
      if (text.includes('[tool.pytest')) {
        const cmd = pytestCommand();
        if (cmd !== null) {
          return cmd;
        }
      }
    } catch {
      // fall through
    }
  }

  const npmTest = npmScriptCommand(projectRoot, 'test');
  if (npmTest !== null) {
    return npmTest;
  }

  const testsDir = join(projectRoot, 'tests');
  if (isDirectory(testsDir)) {
    const cmd = pytestCommand();
    if (cmd !== null) {
      return cmd;
    }
    const py = which('python3') !== null ? 'python3' : which('python') !== null ? 'python' : null;
    if (py === null) {
      return null;
    }
    const preferred = join(testsDir, 'unit');
    if (isDirectory(preferred) && hasTestFiles(preferred)) {
      return [py, '-m', 'unittest', 'discover', 'tests.unit'];
    }
    let entries: string[];
    try {
      entries = readdirSync(testsDir).sort();
    } catch {
      entries = [];
    }
    for (const sub of entries) {
      const subPath = join(testsDir, sub);
      if (isDirectory(subPath) && hasTestFiles(subPath)) {
        return [py, '-m', 'unittest', 'discover', `tests.${sub}`];
      }
    }
    return [py, '-m', 'unittest', 'discover', '-s', 'tests'];
  }

  const makefile = join(projectRoot, 'Makefile');
  if (isFile(makefile)) {
    try {
      for (const line of readFileSync(makefile, 'utf-8').split('\n')) {
        if (line.trim().startsWith('test:')) {
          if (which('make') !== null) {
            return ['make', 'test'];
          }
          break;
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}

function hasTestFiles(dir: string): boolean {
  try {
    return readdirSync(dir).some(
      (name) => name.startsWith('test_') && name.endsWith('.py') && isFile(join(dir, name)),
    );
  } catch {
    return false;
  }
}

/** Auto-detection for gate_1 (type check). */
export function detectGate1Command(projectRoot: string): string[] | null {
  const pyproject = join(projectRoot, 'pyproject.toml');
  if (isFile(pyproject)) {
    if (which('mypy') !== null) {
      return ['mypy', '--no-incremental', '.'];
    }
    if (which('pyright') !== null) {
      return ['pyright'];
    }
  }

  const npmCmd = npmScriptCommand(projectRoot, 'typecheck');
  if (npmCmd !== null) {
    return npmCmd;
  }

  const tsconfig = join(projectRoot, 'tsconfig.json');
  if (isFile(tsconfig)) {
    if (which('tsc') !== null) {
      return ['tsc', '--noEmit'];
    }
    if (which('npx') !== null) {
      return ['npx', 'tsc', '--noEmit'];
    }
  }

  if (isFile(join(projectRoot, 'Cargo.toml'))) {
    if (which('cargo') !== null) {
      return ['cargo', 'check'];
    }
  }

  if (isFile(join(projectRoot, 'go.mod'))) {
    if (which('go') !== null) {
      return ['go', 'vet', './...'];
    }
  }

  return null;
}

/** Auto-detection for gate_2 (lint). */
export function detectGate2Command(projectRoot: string): string[] | null {
  const pyproject = join(projectRoot, 'pyproject.toml');
  if (isFile(pyproject)) {
    if (which('ruff') !== null) {
      return ['ruff', 'check', '.'];
    }
    if (which('flake8') !== null) {
      return ['flake8'];
    }
  }

  const npmCmd = npmScriptCommand(projectRoot, 'lint');
  if (npmCmd !== null) {
    return npmCmd;
  }

  if (isFile(join(projectRoot, 'package.json'))) {
    if (which('eslint') !== null) {
      return ['eslint', '.'];
    }
    if (which('npx') !== null) {
      return ['npx', 'eslint', '.'];
    }
  }

  const eslintCandidates = [
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.js',
    'eslint.config.js',
    'eslint.config.mjs',
  ];
  if (eslintCandidates.some((c) => isFile(join(projectRoot, c)))) {
    if (which('eslint') !== null) {
      return ['eslint', '.'];
    }
    if (which('npx') !== null) {
      return ['npx', 'eslint', '.'];
    }
  }

  if (isFile(join(projectRoot, 'Cargo.toml'))) {
    if (which('cargo') !== null) {
      return ['cargo', 'clippy', '--all-targets', '--', '-D', 'warnings'];
    }
  }

  if (isFile(join(projectRoot, 'go.mod'))) {
    if (which('golangci-lint') !== null) {
      return ['golangci-lint', 'run'];
    }
  }

  return null;
}

/** Auto-detection for gate_3 (coverage). */
export function detectGate3Command(projectRoot: string): string[] | null {
  const pyproject = join(projectRoot, 'pyproject.toml');
  if (isFile(pyproject)) {
    const cmd = pytestCommand();
    if (cmd !== null) {
      try {
        const text = readFileSync(pyproject, 'utf-8');
        if (text.includes('pytest-cov') || text.includes('[tool.coverage')) {
          return [...cmd, '--cov'];
        }
      } catch {
        // fall through
      }
    }
    if (which('coverage') !== null && cmd !== null) {
      return ['sh', '-c', 'coverage run -m pytest && coverage report'];
    }
  }

  for (const name of ['test:coverage', 'coverage']) {
    const npmCmd = npmScriptCommand(projectRoot, name);
    if (npmCmd !== null) {
      return npmCmd;
    }
  }

  if (isFile(join(projectRoot, 'package.json'))) {
    if (which('npx') !== null) {
      return ['npx', 'nyc', 'npm', 'test'];
    }
  }

  if (isFile(join(projectRoot, 'Cargo.toml'))) {
    if (which('cargo-tarpaulin') !== null) {
      return ['cargo', 'tarpaulin'];
    }
    if (which('cargo-llvm-cov') !== null) {
      return ['cargo', 'llvm-cov'];
    }
  }

  if (isFile(join(projectRoot, 'go.mod'))) {
    if (which('go') !== null) {
      return ['go', 'test', '-cover', './...'];
    }
  }

  return null;
}

/** Auto-detection for gate_4 (commit / clean tree). */
export function detectGate4Command(projectRoot: string): string[] | null {
  if (!existsSync(join(projectRoot, '.git'))) {
    return null;
  }
  if (which('git') === null) {
    return null;
  }
  return ['sh', '-c', 'git diff --quiet && git diff --cached --quiet'];
}

const PW_CONFIG_NAMES: ReadonlyArray<string> = [
  'playwright.config.ts',
  'playwright.config.js',
  'playwright.config.mjs',
  'playwright.config.cjs',
];

const CY_CONFIG_NAMES: ReadonlyArray<string> = [
  'cypress.config.ts',
  'cypress.config.js',
  'cypress.config.mjs',
  'cypress.config.cjs',
];

function playwrightCommand(projectRoot: string): string[] | null {
  for (const name of PW_CONFIG_NAMES) {
    if (isFile(join(projectRoot, name))) {
      return ['npx', 'playwright', 'test'];
    }
  }
  return null;
}

function cypressCommand(projectRoot: string): string[] | null {
  for (const name of CY_CONFIG_NAMES) {
    if (isFile(join(projectRoot, name))) {
      return ['npx', 'cypress', 'run'];
    }
  }
  return null;
}

/** Auto-detection for gate_5 (runtime smoke). */
export function detectGate5Command(projectRoot: string): string[] | null {
  const smokeSh = join(projectRoot, 'scripts', 'smoke.sh');
  if (isFile(smokeSh)) {
    return ['sh', smokeSh];
  }

  const pw = playwrightCommand(projectRoot);
  if (pw !== null) {
    return pw;
  }
  const cy = cypressCommand(projectRoot);
  if (cy !== null) {
    return cy;
  }

  for (const name of ['smoke', 'test:e2e']) {
    const npmCmd = npmScriptCommand(projectRoot, name);
    if (npmCmd !== null) {
      return npmCmd;
    }
  }

  const smokeDir = join(projectRoot, 'tests', 'smoke');
  if (isDirectory(smokeDir)) {
    if (which('pytest') !== null) {
      return ['pytest', `tests${pathSep}smoke`];
    }
    const py = which('python3') !== null ? 'python3' : which('python') !== null ? 'python' : null;
    if (py !== null) {
      return [py, '-m', 'unittest', 'discover', '-s', `tests${pathSep}smoke`];
    }
  }

  const makefile = join(projectRoot, 'Makefile');
  if (isFile(makefile)) {
    try {
      for (const line of readFileSync(makefile, 'utf-8').split('\n')) {
        if (line.trim().startsWith('smoke:')) {
          if (which('make') !== null) {
            return ['make', 'smoke'];
          }
          break;
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}

/** No auto-detect for gate_perf — performance tooling varies too widely. */
export function detectGatePerfCommand(_projectRoot: string): string[] | null {
  return null;
}

/** Reads `harness.yaml.gate_commands.<gate>` if available. */
function harnessYamlOverride(harnessDir: string | null, gate: string): string[] | null {
  if (harnessDir === null) {
    return null;
  }
  const path = join(harnessDir, 'harness.yaml');
  if (!isFile(path)) {
    return null;
  }
  let data: unknown;
  try {
    data = yamlParse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const cmds = (data as Record<string, unknown>)['gate_commands'];
  if (cmds === null || typeof cmds !== 'object' || Array.isArray(cmds)) {
    return null;
  }
  const val = (cmds as Record<string, unknown>)[gate];
  if (Array.isArray(val) && val.every((x) => typeof x === 'string')) {
    return val as string[];
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.split(/\s+/).filter((x) => x.length > 0);
  }
  return null;
}

/** Override → harness.yaml → auto-detect command resolution. */
function resolveCommand(
  gate: string,
  projectRoot: string,
  override: ReadonlyArray<string> | null,
  harnessDir: string | null,
  detect: (root: string) => string[] | null,
): string[] | null {
  if (override !== null) {
    return [...override];
  }
  const yamlCmd = harnessYamlOverride(harnessDir, gate);
  if (yamlCmd !== null) {
    return yamlCmd;
  }
  return detect(projectRoot);
}

/** Spawns a command synchronously and packages the GateRunResult. */
function execute(
  gate: string,
  cmd: string[],
  projectRoot: string,
  timeoutSec: number,
): GateRunResult {
  const start = process.hrtime.bigint();
  let proc;
  try {
    proc = spawnSync(cmd[0]!, cmd.slice(1), {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: timeoutSec * 1000,
    });
  } catch (err) {
    return {
      gate,
      result: 'skipped',
      reason: `command not found: ${cmd[0]}`,
      command: cmd,
      exitCode: null,
      stdoutTail: '',
      stderrTail: (err as Error).message ?? '',
      durationSec: 0,
    };
  }

  const elapsed = Number((process.hrtime.bigint() - start) / 1_000_000n) / 1000;
  const stdout = typeof proc.stdout === 'string' ? proc.stdout : '';
  const stderr = typeof proc.stderr === 'string' ? proc.stderr : '';

  if (proc.error !== undefined && proc.error !== null) {
    const errAny = proc.error as NodeJS.ErrnoException;
    if (errAny.code === 'ENOENT') {
      return {
        gate,
        result: 'skipped',
        reason: `command not found: ${cmd[0]}`,
        command: cmd,
        exitCode: null,
        stdoutTail: '',
        stderrTail: '',
        durationSec: 0,
      };
    }
    if ((errAny as NodeJS.ErrnoException & {signal?: string}).signal === 'SIGTERM' || proc.signal === 'SIGTERM') {
      return {
        gate,
        result: 'fail',
        reason: `timeout after ${timeoutSec}s`,
        command: cmd,
        exitCode: null,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
        durationSec: timeoutSec,
      };
    }
  }
  if (proc.signal === 'SIGTERM') {
    return {
      gate,
      result: 'fail',
      reason: `timeout after ${timeoutSec}s`,
      command: cmd,
      exitCode: null,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr),
      durationSec: timeoutSec,
    };
  }

  const status = proc.status ?? -1;
  const result: GateResult = status === 0 ? 'pass' : 'fail';
  return {
    gate,
    result,
    reason: result === 'pass' ? '' : `exit ${status}`,
    command: cmd,
    exitCode: status,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    durationSec: elapsed,
  };
}

/** Skipped-result builder shared across runners. */
function skippedResult(gate: string, reason: string): GateRunResult {
  return {
    gate,
    result: 'skipped',
    reason,
    command: [],
    exitCode: null,
    stdoutTail: '',
    stderrTail: '',
    durationSec: 0,
  };
}

/** gate_0 (tests). */
export function runGate0(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_0',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate0Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_0',
      'no test command detected (pyproject.toml · tests/ · package.json · Makefile 모두 부재)',
    );
  }
  return execute('gate_0', cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}

/** gate_1 (type check). */
export function runGate1(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_1',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate1Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_1',
      'no type checker detected (pyproject.toml · tsconfig.json · Cargo.toml · go.mod 모두 부재 또는 tool 미설치)',
    );
  }
  return execute('gate_1', cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}

/** gate_2 (lint). */
export function runGate2(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_2',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate2Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_2',
      'no linter detected (pyproject/ruff · package.json/eslint · Cargo/clippy · go.mod/golangci-lint 모두 부재)',
    );
  }
  return execute('gate_2', cmd, projectRoot, options.timeoutSec ?? DEFAULT_TIMEOUT_SEC);
}

/** gate_3 (coverage). */
export function runGate3(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_3',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate3Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_3',
      'no coverage tool detected (pytest-cov · nyc · scripts.coverage · tarpaulin · go -cover 모두 부재)',
    );
  }
  return execute('gate_3', cmd, projectRoot, options.timeoutSec ?? 600);
}

/** gate_4 (working tree clean). */
export function runGate4(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_4',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate4Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_4',
      'not a git repo or git binary 부재 — commit gate 검증 불가',
    );
  }
  return execute('gate_4', cmd, projectRoot, options.timeoutSec ?? 30);
}

/** gate_5 (runtime smoke). */
export function runGate5(projectRoot: string, options: RunGateOptions = {}): GateRunResult {
  const cmd = resolveCommand(
    'gate_5',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGate5Command,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_5',
      'no runtime smoke detected (scripts/smoke.sh · tests/smoke/ · Makefile smoke · package.json scripts.smoke 모두 부재) — harness.yaml.gate_commands.gate_5 로 설정 필요',
    );
  }
  return execute('gate_5', cmd, projectRoot, options.timeoutSec ?? 600);
}

/** gate_perf (performance budget). */
export function runGatePerf(
  projectRoot: string,
  options: RunGateOptions = {},
): GateRunResult {
  const cmd = resolveCommand(
    'gate_perf',
    projectRoot,
    options.overrideCommand ?? null,
    options.harnessDir ?? null,
    detectGatePerfCommand,
  );
  if (cmd === null) {
    return skippedResult(
      'gate_perf',
      'no perf runner configured — harness.yaml.gate_commands.gate_perf 또는 --override-command 필요',
    );
  }
  return execute('gate_perf', cmd, projectRoot, options.timeoutSec ?? 900);
}

/** Dispatcher — maps a gate name to its runner. */
export function runGate(
  gate: string,
  projectRoot: string,
  options: RunGateOptions = {},
): GateRunResult {
  switch (gate) {
    case 'gate_0':
      return runGate0(projectRoot, options);
    case 'gate_1':
      return runGate1(projectRoot, options);
    case 'gate_2':
      return runGate2(projectRoot, options);
    case 'gate_3':
      return runGate3(projectRoot, options);
    case 'gate_4':
      return runGate4(projectRoot, options);
    case 'gate_5':
      return runGate5(projectRoot, options);
    case 'gate_perf':
      return runGatePerf(projectRoot, options);
    default:
      return skippedResult(
        gate,
        `${gate} auto-run not yet supported (v0.3.7 shipped gate_0~gate_5)`,
      );
  }
}
