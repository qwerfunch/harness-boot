/**
 * Unit tests for `src/init/codebase/redact.ts` (F-161).
 *
 * Run via `npm test`.
 */

import {describe, expect, it} from 'vitest';

import {isForbiddenFile, redactSecrets} from '../../src/init/codebase/redact.js';

describe('redactSecrets', () => {
  it('redacts an OpenAI key', () => {
    const r = redactSecrets('const key = "sk-abcdefghijklmnopqrstuvwx"');
    expect(r.text).toContain('[REDACTED: openai-key]');
    expect(r.text).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(r.matches).toHaveLength(1);
  });

  it('redacts a GitHub PAT', () => {
    const r = redactSecrets('token=ghp_abcdefghij1234567890ABCDEFGHIJ');
    expect(r.text).toContain('[REDACTED: github-token]');
    expect(r.text).not.toMatch(/ghp_[A-Za-z0-9]/);
  });

  it('redacts an AWS access-key id', () => {
    const r = redactSecrets('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
    expect(r.text).toContain('[REDACTED: aws-access-key-id]');
  });

  it('redacts generic api-key style assignments', () => {
    const r = redactSecrets('apiKey: "abcdef0123456789abcdef0123456789"');
    expect(r.text).toContain('[REDACTED: credential-assignment]');
  });

  it('redacts urls with embedded credentials', () => {
    const r = redactSecrets('connect to postgres://user:s3cretpass@db:5432/app');
    expect(r.text).toContain('[REDACTED: url-credential]');
  });

  it('is idempotent on already-redacted text', () => {
    const first = redactSecrets('sk-abcdefghijklmnopqrstuvwx');
    const second = redactSecrets(first.text);
    expect(second.text).toBe(first.text);
    expect(second.matches).toHaveLength(0);
  });

  it('leaves non-secret text alone', () => {
    const sample = 'function greet(name) { return `hello ${name}`; }';
    const r = redactSecrets(sample);
    expect(r.text).toBe(sample);
    expect(r.matches).toHaveLength(0);
  });

  it('reports match offsets in input order', () => {
    const r = redactSecrets('a=sk-abcdefghijklmnopqrstuvwx then b=AKIAIOSFODNN7EXAMPLE');
    expect(r.matches).toHaveLength(2);
    expect(r.matches[0]!.start).toBeLessThan(r.matches[1]!.start);
  });
});

describe('isForbiddenFile', () => {
  it('returns true for env files', () => {
    expect(isForbiddenFile('.env')).toBe(true);
    expect(isForbiddenFile('.env.local')).toBe(true);
    expect(isForbiddenFile('.envrc')).toBe(true);
  });

  it('returns true for secrets manifests', () => {
    expect(isForbiddenFile('secrets.yaml')).toBe(true);
    expect(isForbiddenFile('credentials.json')).toBe(true);
  });

  it('returns false for ordinary source files', () => {
    expect(isForbiddenFile('package.json')).toBe(false);
    expect(isForbiddenFile('src/index.ts')).toBe(false);
  });

  it('treats nested paths by basename', () => {
    expect(isForbiddenFile('subdir/.env')).toBe(true);
    expect(isForbiddenFile('foo/bar/baz.ts')).toBe(false);
  });
});
