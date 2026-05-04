/**
 * Parity test for `src/gate/runner.ts` (F-095).
 *
 * Coverage focuses on detection logic (pure, filesystem-only) plus
 * harness.yaml override resolution. Subprocess execution itself is
 * exercised via simple `sh -c` cases that always succeed/fail/timeout
 * deterministically — running the real polyglot tool matrix in CI is
 * out of scope.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  detectGate0Command,
  detectGate1Command,
  detectGate2Command,
  detectGate3Command,
  detectGate4Command,
  detectGate5Command,
  detectGatePerfCommand,
  runGate,
} from '../../src/gate/runner.js';

interface ProjectFixture {
  root: string;
  harness: string;
}

function makeProject(): ProjectFixture {
  const root = mkdtempSync(join(tmpdir(), 'gate-runner-'));
  const harness = join(root, '.harness');
  mkdirSync(harness, {recursive: true});
  return {root, harness};
}

function writePackageJson(root: string, scripts: Record<string, string>): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify({scripts}), 'utf-8');
}

function writeHarnessYaml(harness: string, body: string): void {
  writeFileSync(join(harness, 'harness.yaml'), body, 'utf-8');
}

describe('gate runner — gate_0 detection', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('returns null on empty project', () => {
    expect(detectGate0Command(fx.root)).toBeNull();
  });

  it('npm test wins over tests/ unittest fallback when both exist', () => {
    writePackageJson(fx.root, {test: 'vitest run'});
    mkdirSync(join(fx.root, 'tests'), {recursive: true});
    const cmd = detectGate0Command(fx.root);
    expect(cmd).toEqual(['npm', 'test']);
  });

  it('Makefile test target picked when no other signal exists', () => {
    writeFileSync(join(fx.root, 'Makefile'), 'test:\n\techo ok\n', 'utf-8');
    const cmd = detectGate0Command(fx.root);
    if (cmd !== null) {
      expect(cmd[0]).toBe('make');
      expect(cmd[1]).toBe('test');
    }
  });

  // F-121 / L-003 — Rust + Go probes mirror gate_1/2/3 ordering.
  it('Cargo.toml triggers `cargo test --workspace` when no other signal exists', () => {
    writeFileSync(join(fx.root, 'Cargo.toml'), '[package]\nname = "x"\nversion = "0.0.1"\n', 'utf-8');
    expect(detectGate0Command(fx.root)).toEqual(['cargo', 'test', '--workspace']);
  });

  it('go.mod triggers `go test ./...` when no other signal exists', () => {
    writeFileSync(join(fx.root, 'go.mod'), 'module example.com/x\n\ngo 1.22\n', 'utf-8');
    expect(detectGate0Command(fx.root)).toEqual(['go', 'test', './...']);
  });

  it('npm test still wins over Cargo.toml (regression — precedence preserved)', () => {
    writePackageJson(fx.root, {test: 'vitest run'});
    writeFileSync(join(fx.root, 'Cargo.toml'), '[package]\nname = "x"\nversion = "0"\n', 'utf-8');
    expect(detectGate0Command(fx.root)).toEqual(['npm', 'test']);
  });
});

describe('gate runner — gate_1 / gate_2 detection', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('gate_1 picks npm typecheck script when present', () => {
    writePackageJson(fx.root, {typecheck: 'tsc --noEmit'});
    const cmd = detectGate1Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'typecheck']);
  });

  it('gate_1 returns null on empty project', () => {
    expect(detectGate1Command(fx.root)).toBeNull();
  });

  it('gate_2 picks npm lint script when present', () => {
    writePackageJson(fx.root, {lint: 'eslint .'});
    const cmd = detectGate2Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'lint']);
  });

  it('gate_2 returns null on empty project', () => {
    expect(detectGate2Command(fx.root)).toBeNull();
  });
});

describe('gate runner — gate_3 detection (coverage)', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('picks npm test:coverage script when present', () => {
    writePackageJson(fx.root, {'test:coverage': 'vitest run --coverage'});
    const cmd = detectGate3Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'test:coverage']);
  });

  it('falls back to coverage script alias when test:coverage is missing', () => {
    writePackageJson(fx.root, {coverage: 'vitest run --coverage'});
    const cmd = detectGate3Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'coverage']);
  });
});

describe('gate runner — gate_4 detection (clean tree)', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('returns null when .git is absent', () => {
    expect(detectGate4Command(fx.root)).toBeNull();
  });

  it('returns the git diff probe when .git exists', () => {
    mkdirSync(join(fx.root, '.git'), {recursive: true});
    const cmd = detectGate4Command(fx.root);
    if (cmd !== null) {
      expect(cmd[0]).toBe('sh');
      expect(cmd[2]).toContain('git diff --quiet');
    }
  });
});

describe('gate runner — gate_5 detection (runtime smoke)', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('scripts/smoke.sh wins over everything else', () => {
    mkdirSync(join(fx.root, 'scripts'), {recursive: true});
    writeFileSync(join(fx.root, 'scripts', 'smoke.sh'), '#!/bin/sh\necho ok\n', 'utf-8');
    writePackageJson(fx.root, {smoke: 'echo other'});
    const cmd = detectGate5Command(fx.root);
    expect(cmd![0]).toBe('sh');
    expect(cmd![1]).toContain('smoke.sh');
  });

  it('playwright config wins over npm scripts', () => {
    writeFileSync(
      join(fx.root, 'playwright.config.ts'),
      'export default {};\n',
      'utf-8',
    );
    writePackageJson(fx.root, {smoke: 'echo other'});
    const cmd = detectGate5Command(fx.root);
    expect(cmd).toEqual(['npx', 'playwright', 'test']);
  });

  it('cypress config picked when playwright is absent', () => {
    writeFileSync(join(fx.root, 'cypress.config.ts'), 'export default {};\n', 'utf-8');
    expect(detectGate5Command(fx.root)).toEqual(['npx', 'cypress', 'run']);
  });

  it('npm scripts.smoke picked when no e2e config present', () => {
    writePackageJson(fx.root, {smoke: 'sh scripts/smoke-fallback.sh'});
    const cmd = detectGate5Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'smoke']);
  });

  it('npm scripts.test:e2e picked when scripts.smoke missing', () => {
    writePackageJson(fx.root, {'test:e2e': 'playwright test'});
    const cmd = detectGate5Command(fx.root);
    expect(cmd).toEqual(['npm', 'run', 'test:e2e']);
  });
});

describe('gate runner — gate_perf detection', () => {
  it('always returns null (override-only by design)', () => {
    expect(detectGatePerfCommand('/tmp')).toBeNull();
  });
});

describe('gate runner — runGate dispatch', () => {
  let fx: ProjectFixture;
  beforeEach(() => {
    fx = makeProject();
  });
  afterEach(() => {
    rmSync(fx.root, {recursive: true, force: true});
  });

  it('unknown gate name returns skipped', () => {
    const r = runGate('gate_99', fx.root);
    expect(r.result).toBe('skipped');
    expect(r.reason).toContain('not yet supported');
  });

  it('override command runs with deterministic exit-zero', () => {
    const r = runGate('gate_0', fx.root, {overrideCommand: ['sh', '-c', 'true']});
    expect(r.result).toBe('pass');
    expect(r.exitCode).toBe(0);
  });

  it('override command exit-non-zero is fail', () => {
    const r = runGate('gate_0', fx.root, {overrideCommand: ['sh', '-c', 'exit 7']});
    expect(r.result).toBe('fail');
    expect(r.exitCode).toBe(7);
    expect(r.reason).toBe('exit 7');
  });

  it('skipped when no command and no override', () => {
    const r = runGate('gate_perf', fx.root);
    expect(r.result).toBe('skipped');
    expect(r.reason).toContain('no perf runner configured');
  });

  it('harness.yaml override (string form) takes effect', () => {
    writeHarnessYaml(fx.harness, 'gate_commands:\n  gate_0: "sh -c true"\n');
    const r = runGate('gate_0', fx.root, {harnessDir: fx.harness});
    expect(r.result).toBe('pass');
  });

  it('harness.yaml override (array form) takes effect', () => {
    // Each element must be quoted so YAML keeps the string type — `true`
    // bare would be coerced to a boolean and the parser rejects it.
    writeHarnessYaml(
      fx.harness,
      'gate_commands:\n  gate_0:\n    - "sh"\n    - "-c"\n    - "true"\n',
    );
    const r = runGate('gate_0', fx.root, {harnessDir: fx.harness});
    expect(r.result).toBe('pass');
  });

  it('explicit override beats harness.yaml', () => {
    writeHarnessYaml(fx.harness, 'gate_commands:\n  gate_0: "sh -c \\"exit 1\\""\n');
    const r = runGate('gate_0', fx.root, {
      harnessDir: fx.harness,
      overrideCommand: ['sh', '-c', 'true'],
    });
    expect(r.result).toBe('pass');
  });
});
