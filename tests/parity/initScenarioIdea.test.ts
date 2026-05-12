/**
 * Unit tests for `src/init/scenarioIdea.ts` (F-159).
 *
 * Covers:
 *
 *   - Required fields land in the spec.yaml output.
 *   - Quality-focus values pass through verbatim.
 *   - Skeleton feature stays at F-0; user features start at F-1.
 *   - Confidence heuristic: medium when name + vision + ≥ 3 features.
 *   - Draft label + content_hash present (handed off to `stampDraftLabel`).
 *
 * Run via `npm test`.
 */

import {describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {generateIdeaSpec} from '../../src/init/scenarioIdea.js';

describe('generateIdeaSpec', () => {
  it('produces a v2.3 spec with project · domain · constraints · deliverable · features', () => {
    const result = generateIdeaSpec({
      name: 'pomodoro-musicians',
      vision: '25/5 timer for solo practice',
      features: ['session start/stop', 'round counter', 'instrument warmup'],
      mode: 'prototype',
      qualityFocus: ['design', 'accessibility'],
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    expect(parsed['version']).toBe('2.3');

    const project = parsed['project'] as Record<string, unknown>;
    expect(project['name']).toBe('pomodoro-musicians');
    expect(project['summary']).toBe('25/5 timer for solo practice');
    expect(project['mode']).toBe('prototype');

    expect(parsed['domain']).toBeDefined();
    expect(parsed['constraints']).toBeDefined();

    const deliverable = parsed['deliverable'] as Record<string, unknown>;
    expect(deliverable['type']).toBe('cli');
    expect(Array.isArray(deliverable['smoke_scenarios'])).toBe(true);
  });

  it('passes quality_focus values through verbatim', () => {
    const result = generateIdeaSpec({
      name: 'x',
      vision: 'y',
      features: ['a'],
      mode: 'product',
      qualityFocus: ['performance', 'security'],
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const metadata = parsed['metadata'] as Record<string, unknown>;
    expect(metadata['quality_focus']).toEqual(['performance', 'security']);
  });

  it('keeps F-0 skeleton and starts user features at F-1', () => {
    const result = generateIdeaSpec({
      name: 'demo',
      vision: 'demo',
      features: ['alpha', 'beta'],
      mode: 'prototype',
      qualityFocus: [],
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const features = parsed['features'] as ReadonlyArray<Record<string, unknown>>;
    expect(features).toHaveLength(3);
    expect(features[0]!['id']).toBe('F-0');
    expect(features[0]!['type']).toBe('skeleton');
    expect(features[1]!['id']).toBe('F-1');
    expect(features[1]!['title']).toBe('alpha');
    expect(features[2]!['id']).toBe('F-2');
    expect(features[2]!['title']).toBe('beta');
  });

  it('rates confidence medium with ≥ 3 features + name + vision', () => {
    const result = generateIdeaSpec({
      name: 'x',
      vision: 'y',
      features: ['a', 'b', 'c'],
      mode: 'prototype',
      qualityFocus: [],
    });
    expect(result.confidence).toBe('medium');
  });

  it('rates confidence low otherwise', () => {
    const result = generateIdeaSpec({
      name: 'x',
      vision: 'y',
      features: ['only one'],
      mode: 'prototype',
      qualityFocus: [],
    });
    expect(result.confidence).toBe('low');
  });

  it('stamps metadata.source.origin = idea and metadata.draft = true', () => {
    const result = generateIdeaSpec({
      name: 'x',
      vision: 'y',
      features: ['a', 'b', 'c'],
      mode: 'prototype',
      qualityFocus: [],
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const metadata = parsed['metadata'] as Record<string, unknown>;
    const source = metadata['source'] as Record<string, unknown>;
    expect(source['origin']).toBe('idea');
    expect(metadata['draft']).toBe(true);
    expect(typeof metadata['content_hash']).toBe('string');
    expect(result.contentHash).toBe(metadata['content_hash']);
  });

  it('respects deliverableType override', () => {
    const result = generateIdeaSpec({
      name: 'x',
      vision: 'y',
      features: ['a'],
      mode: 'prototype',
      qualityFocus: [],
      deliverableType: 'web-service',
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const deliverable = parsed['deliverable'] as Record<string, unknown>;
    expect(deliverable['type']).toBe('web-service');
  });
});
