import { describe, expect, it } from 'vitest';

import {
  HooksConfigError,
  joinConfig,
  parseHooksJson,
  parseMetaJson,
} from '../../../src/core/hooks/config.js';

// 커버: tdd_focus 3 (meta.json ↔ hooks.json id 매칭 불일치 탐지) 와
// BR-005 공식 필드 · 확장 필드 분리 불변식.

describe('parseHooksJson', () => {
  it('accepts all 7 events with minimal command hook', () => {
    const raw = {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'echo pre' }] }],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'echo post' }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'echo compact' }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo start' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
      SessionEnd: [{ hooks: [{ type: 'command', command: 'echo end' }] }],
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command: 'echo prompt' }] },
      ],
    };

    const parsed = parseHooksJson(raw);

    expect(Object.keys(parsed).sort()).toEqual([
      'PostToolUse',
      'PreCompact',
      'PreToolUse',
      'SessionEnd',
      'SessionStart',
      'Stop',
      'UserPromptSubmit',
    ]);
  });

  it('rejects unknown event names', () => {
    expect(() =>
      parseHooksJson({
        NotAnEvent: [{ hooks: [{ type: 'command', command: 'x' }] }],
      }),
    ).toThrow(HooksConfigError);
  });

  it('rejects non-command type', () => {
    expect(() =>
      parseHooksJson({
        PreToolUse: [{ hooks: [{ type: 'unknown', command: 'x' }] }],
      }),
    ).toThrow(HooksConfigError);
  });

  it('rejects negative timeout', () => {
    expect(() =>
      parseHooksJson({
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'x', timeout: -1 }] },
        ],
      }),
    ).toThrow(HooksConfigError);
  });

  it('rejects invalid shell value', () => {
    expect(() =>
      parseHooksJson({
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'x', shell: 'fish' }] },
        ],
      }),
    ).toThrow(HooksConfigError);
  });

  it('preserves optional matcher on the block', () => {
    const raw = {
      PreToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [{ type: 'command', command: 'x' }],
        },
      ],
    };

    const parsed = parseHooksJson(raw);

    expect(parsed.PreToolUse?.[0]?.matcher).toBe('Write|Edit');
  });
});

describe('parseMetaJson', () => {
  it('accepts valid meta entries with env and allowedEnvVars', () => {
    const raw = {
      allowedEnvVars: ['FOO', 'BAR'],
      hooks: [
        {
          id: 'pre-write-formatter',
          event: 'PreToolUse',
          matcher: 'Write|Edit',
          index: 0,
          description: 'format on write',
          env: { FOO: 'bar' },
        },
      ],
    };

    const parsed = parseMetaJson(raw);

    expect(parsed.hooks).toHaveLength(1);
    expect(parsed.hooks[0]?.id).toBe('pre-write-formatter');
    expect(parsed.allowedEnvVars).toEqual(['FOO', 'BAR']);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      parseMetaJson({
        hooks: [
          { id: 'dup', event: 'PreToolUse', index: 0 },
          { id: 'dup', event: 'PostToolUse', index: 0 },
        ],
      }),
    ).toThrow(/DUPLICATE_ID/);
  });

  it('rejects unknown event in meta', () => {
    expect(() =>
      parseMetaJson({
        hooks: [{ id: 'x', event: 'Ghost', index: 0 }],
      }),
    ).toThrow(HooksConfigError);
  });

  it('rejects non-integer index', () => {
    expect(() =>
      parseMetaJson({
        hooks: [{ id: 'x', event: 'PreToolUse', index: 1.5 }],
      }),
    ).toThrow(HooksConfigError);
  });
});

describe('joinConfig', () => {
  const official = {
    PreToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          { type: 'command' as const, command: 'fmt' },
          { type: 'command' as const, command: 'lint' },
        ],
      },
    ],
    Stop: [
      {
        hooks: [{ type: 'command' as const, command: 'cleanup' }],
      },
    ],
  };

  it('matches official entries to meta by (event, matcher, index)', () => {
    const meta = {
      hooks: [
        {
          id: 'pre-fmt',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 0,
          env: { FMT: '1' },
        },
        {
          id: 'pre-lint',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 1,
        },
        { id: 'stop-clean', event: 'Stop' as const, index: 0 },
      ],
    };

    const resolved = joinConfig(official, meta);

    expect(resolved.map((r) => r.id)).toEqual([
      'pre-fmt',
      'pre-lint',
      'stop-clean',
    ]);
    expect(resolved[0]?.env).toEqual({ FMT: '1' });
    expect(resolved[2]?.matcher).toBeUndefined();
  });

  it('throws META_MISSING when an official entry has no meta', () => {
    const meta = {
      hooks: [
        {
          id: 'pre-fmt',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 0,
        },
        // missing pre-lint (index 1) and stop-clean
      ],
    };

    expect(() => joinConfig(official, meta)).toThrow(/META_MISSING/);
  });

  it('throws META_ORPHAN when meta references a non-existent official entry', () => {
    const meta = {
      hooks: [
        {
          id: 'pre-fmt',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 0,
        },
        {
          id: 'pre-lint',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 1,
        },
        { id: 'stop-clean', event: 'Stop' as const, index: 0 },
        {
          id: 'ghost',
          event: 'PreCompact' as const,
          index: 99, // no official entry
        },
      ],
    };

    expect(() => joinConfig(official, meta)).toThrow(/META_ORPHAN/);
  });

  it('throws MATCHER_MISMATCH when matcher strings diverge', () => {
    const meta = {
      hooks: [
        {
          id: 'pre-fmt',
          event: 'PreToolUse' as const,
          matcher: 'WrongMatcher',
          index: 0,
        },
        {
          id: 'pre-lint',
          event: 'PreToolUse' as const,
          matcher: 'Write|Edit',
          index: 1,
        },
        { id: 'stop-clean', event: 'Stop' as const, index: 0 },
      ],
    };

    expect(() => joinConfig(official, meta)).toThrow(/MATCHER_MISMATCH/);
  });
});
