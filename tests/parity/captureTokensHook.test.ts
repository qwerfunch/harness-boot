/**
 * F-174 — Stop-hook auto token capture parity test.
 *
 * Drives `hooks/capture-tokens.sh` through `spawnSync` with a synthetic
 * Stop-event payload + a synthetic transcript JSONL, and asserts the
 * hook ends up appending an `llm_call` event to `events.log` via the
 * F-172 `harness token` CLI.
 *
 * Each fail-open exit path (missing `.harness/`, missing transcript,
 * no active feature, no `usage`) is exercised separately to lock the
 * silent-exit contract in.
 */

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

const repoRoot = resolve(__dirname, '..', '..');
const hookScript = join(repoRoot, 'hooks', 'capture-tokens.sh');
const harnessBin = join(repoRoot, 'bin', 'harness');

interface Workspace {
  dir: string;
  harness: string;
  transcript: string;
}

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'capture-tokens-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  const state = {
    version: '2.3',
    schema_version: '2.3',
    features: [{id: 'F-001', status: 'in_progress', evidence: [], gates: {}}],
    session: {
      started_at: null,
      last_command: '',
      last_gate_passed: null,
      active_feature_id: 'F-001',
    },
  };
  writeFileSync(join(harness, 'state.yaml'), yamlStringify(state), 'utf-8');
  return {dir, harness, transcript: join(dir, 'transcript.jsonl')};
}

function writeTranscript(path: string, lines: object[]): void {
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf-8');
}

function runHook(payload: object, env: NodeJS.ProcessEnv = {}): {stdout: string; stderr: string; status: number | null} {
  const result = spawnSync('bash', [hookScript], {
    input: JSON.stringify(payload),
    env: {...process.env, HARNESS_BIN: harnessBin, CAPTURE_TOKENS_KIND: 'subagent', ...env},
    encoding: 'utf-8',
  });
  return {stdout: result.stdout, stderr: result.stderr, status: result.status};
}

describe('capture-tokens.sh (F-174 Stop hook)', () => {
  let ws: Workspace;

  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('appends one llm_call event from the latest assistant message.usage', () => {
    writeTranscript(ws.transcript, [
      {type: 'user', message: {role: 'user', content: 'hi'}},
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-7',
          usage: {input_tokens: 1234, output_tokens: 567},
        },
      },
    ]);

    const r = runHook({
      session_id: 'sid',
      cwd: ws.dir,
      transcript_path: ws.transcript,
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    expect(r.status).toBe(0);

    const log = readFileSync(join(ws.harness, 'events.log'), 'utf8');
    const lines = log.split('\n').filter((l) => l.length > 0);
    // exactly one llm_call line.
    const calls = lines.map((l) => JSON.parse(l)).filter((e) => e.type === 'llm_call');
    expect(calls).toHaveLength(1);
    expect(calls[0].scenario).toBe('work');
    expect(calls[0].tokens_in).toBe(1234);
    expect(calls[0].tokens_out).toBe(567);
    expect(calls[0].model).toBe('claude-opus-4-7');
    expect(calls[0].feature).toBe('F-001');
    expect(calls[0].agent).toBe('subagent');
  });

  it('picks the LATEST usage when the transcript has multiple assistant turns', () => {
    writeTranscript(ws.transcript, [
      {
        type: 'assistant',
        message: {model: 'claude-sonnet-4-6', usage: {input_tokens: 100, output_tokens: 50}},
      },
      {type: 'user', message: {role: 'user', content: 'continue'}},
      {
        type: 'assistant',
        message: {model: 'claude-opus-4-7', usage: {input_tokens: 999, output_tokens: 333}},
      },
    ]);

    runHook({cwd: ws.dir, transcript_path: ws.transcript});

    const entry = readFileSync(join(ws.harness, 'events.log'), 'utf8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l))
      .find((e) => e.type === 'llm_call');
    expect(entry.tokens_in).toBe(999);
    expect(entry.tokens_out).toBe(333);
    expect(entry.model).toBe('claude-opus-4-7');
  });

  it('exits 0 silently when no `.harness/` exists in cwd (foreign session)', () => {
    const foreign = mkdtempSync(join(tmpdir(), 'capture-tokens-foreign-'));
    try {
      writeTranscript(join(foreign, 'transcript.jsonl'), [
        {type: 'assistant', message: {model: 'm', usage: {input_tokens: 1, output_tokens: 1}}},
      ]);
      const r = runHook({cwd: foreign, transcript_path: join(foreign, 'transcript.jsonl')});
      expect(r.status).toBe(0);
      // no .harness/, so no events.log to assert against — just confirm
      // the hook didn't crash.
      expect(existsSync(join(foreign, '.harness'))).toBe(false);
    } finally {
      rmSync(foreign, {recursive: true, force: true});
    }
  });

  it('exits 0 silently when no active feature is set', () => {
    // overwrite state.yaml to clear the active feature
    const state = {
      version: '2.3',
      schema_version: '2.3',
      features: [],
      session: {
        started_at: null,
        last_command: '',
        last_gate_passed: null,
        active_feature_id: null,
      },
    };
    writeFileSync(join(ws.harness, 'state.yaml'), yamlStringify(state), 'utf-8');
    writeTranscript(ws.transcript, [
      {type: 'assistant', message: {model: 'm', usage: {input_tokens: 1, output_tokens: 1}}},
    ]);

    const r = runHook({cwd: ws.dir, transcript_path: ws.transcript});
    expect(r.status).toBe(0);
    expect(existsSync(join(ws.harness, 'events.log'))).toBe(false);
  });

  it('exits 0 silently when the transcript contains no `usage` field', () => {
    writeTranscript(ws.transcript, [
      {type: 'user', message: {role: 'user', content: 'just a chat line'}},
      {type: 'assistant', message: {model: 'm', content: 'no usage here'}},
    ]);

    const r = runHook({cwd: ws.dir, transcript_path: ws.transcript});
    expect(r.status).toBe(0);
    expect(existsSync(join(ws.harness, 'events.log'))).toBe(false);
  });

  it('exits 0 silently when the transcript_path does not exist', () => {
    const r = runHook({cwd: ws.dir, transcript_path: '/tmp/does-not-exist-' + Date.now() + '.jsonl'});
    expect(r.status).toBe(0);
    expect(existsSync(join(ws.harness, 'events.log'))).toBe(false);
  });

  it('exits 0 silently on malformed stdin (no crash)', () => {
    const result = spawnSync('bash', [hookScript], {
      input: 'not-json-{',
      env: {...process.env, HARNESS_BIN: harnessBin},
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
  });

  it('HARNESS_DISABLE_TOKEN_HOOK=1 → exits 0 with no work, even on a happy path', () => {
    // Same setup as the first happy-path case — active feature, usage
    // in transcript — but the opt-out env disables every side effect.
    writeTranscript(ws.transcript, [
      {
        type: 'assistant',
        message: {model: 'claude-opus-4-7', usage: {input_tokens: 1, output_tokens: 1}},
      },
    ]);
    const r = runHook(
      {cwd: ws.dir, transcript_path: ws.transcript},
      {HARNESS_DISABLE_TOKEN_HOOK: '1'},
    );
    expect(r.status).toBe(0);
    expect(existsSync(join(ws.harness, 'events.log'))).toBe(false);
  });

  it('fast-path: foreign cwd via CLAUDE_PROJECT_DIR short-circuits without invoking the CLI', () => {
    // Point CLAUDE_PROJECT_DIR at a dir with no `.harness/` AND make
    // the stdin payload claim the same (so neither probe finds harness).
    // The hook should exit 0 without ever calling `harness`. To prove
    // it didn't reach the CLI, point HARNESS_BIN at a non-existent
    // executable — if the fast-path is wired, the hook never tries to
    // run it and exit stays 0.
    const foreign = mkdtempSync(join(tmpdir(), 'capture-tokens-foreign-fast-'));
    try {
      writeTranscript(join(foreign, 'transcript.jsonl'), [
        {type: 'assistant', message: {model: 'm', usage: {input_tokens: 1, output_tokens: 1}}},
      ]);
      const r = runHook(
        {cwd: foreign, transcript_path: join(foreign, 'transcript.jsonl')},
        {CLAUDE_PROJECT_DIR: foreign, HARNESS_BIN: '/nonexistent/harness-' + Date.now()},
      );
      expect(r.status).toBe(0);
      expect(existsSync(join(foreign, '.harness'))).toBe(false);
    } finally {
      rmSync(foreign, {recursive: true, force: true});
    }
  });
});
