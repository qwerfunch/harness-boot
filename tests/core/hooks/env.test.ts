import { describe, expect, it } from 'vitest';

import { resolveEnv } from '../../../src/core/hooks/env.js';

// 커버: tdd_focus 4 (env 주입 시 allowedEnvVars 정책 준수 + 비밀 마스킹).

describe('resolveEnv', () => {
  it('returns empty env and denies all hookEnv when allowlist is empty', () => {
    const resolution = resolveEnv(
      { FOO: 'bar', SECRET: 'xxx' },
      { FOO: 'process-foo' },
      { allowedEnvVars: [] },
    );

    expect(resolution.env).toEqual({});
    expect(resolution.denied).toEqual(expect.arrayContaining(['FOO', 'SECRET']));
    expect(resolution.denied).toHaveLength(2);
  });

  it('forwards allowlisted hookEnv keys overriding processEnv', () => {
    const resolution = resolveEnv(
      { FOO: 'hook-foo' },
      { FOO: 'process-foo', BAR: 'process-bar' },
      { allowedEnvVars: ['FOO', 'BAR'] },
    );

    expect(resolution.env).toEqual({ FOO: 'hook-foo', BAR: 'process-bar' });
    expect(resolution.denied).toEqual([]);
  });

  it('excludes processEnv keys not in allowlist', () => {
    const resolution = resolveEnv(
      undefined,
      { FOO: 'a', SECRET_TOKEN: 'nope', PATH: '/bin' },
      { allowedEnvVars: ['FOO'] },
    );

    expect(resolution.env).toEqual({ FOO: 'a' });
    // processEnv 비허용 키는 denied 에 포함하지 않는다 (hookEnv 의 의도적 주입만 추적).
    expect(resolution.denied).toEqual([]);
  });

  it('masks denied hookEnv values — they must never appear in returned env', () => {
    const resolution = resolveEnv(
      { SECRET_TOKEN: 'leak-this-value' },
      {},
      { allowedEnvVars: ['FOO'] },
    );

    expect(resolution.env).toEqual({});
    expect(resolution.denied).toEqual(['SECRET_TOKEN']);
    expect(Object.values(resolution.env)).not.toContain('leak-this-value');
  });

  it('skips undefined processEnv values', () => {
    const resolution = resolveEnv(
      undefined,
      { FOO: undefined, BAR: 'b' },
      { allowedEnvVars: ['FOO', 'BAR'] },
    );

    expect(resolution.env).toEqual({ BAR: 'b' });
  });

  it('is deterministic — same input yields identical output', () => {
    const a = resolveEnv(
      { FOO: '1' },
      { BAR: '2' },
      { allowedEnvVars: ['FOO', 'BAR'] },
    );
    const b = resolveEnv(
      { FOO: '1' },
      { BAR: '2' },
      { allowedEnvVars: ['FOO', 'BAR'] },
    );

    expect(a).toEqual(b);
  });
});
