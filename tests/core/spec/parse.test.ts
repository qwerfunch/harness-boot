import { describe, expect, it } from 'vitest';

import { parseSpecYaml } from '../../../src/core/spec/parse.js';

describe('parseSpecYaml', () => {
  it('parses a minimal valid spec document into a plain object', () => {
    const src = [
      'version: "2.3.6"',
      'project:',
      '  name: demo',
      '  version: "0.1.0"',
    ].join('\n');

    const result = parseSpecYaml(src);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as { version: string }).version).toBe('2.3.6');
      expect(
        (result.data as { project: { name: string } }).project.name,
      ).toBe('demo');
    }
  });

  it('reports human-readable error for malformed YAML', () => {
    const src = 'version: "2.3.6"\nproject:\n  name: [unclosed';

    const result = parseSpecYaml(src);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/YAML 파싱 실패/);
    }
  });

  it('rejects empty input as failure', () => {
    const result = parseSpecYaml('');

    expect(result.ok).toBe(false);
  });

  it('rejects whitespace-only input as failure', () => {
    const result = parseSpecYaml('   \n  \n');

    expect(result.ok).toBe(false);
  });
});
