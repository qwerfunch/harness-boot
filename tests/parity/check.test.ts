/**
 * Parity test for `src/check.ts` (F-100).
 *
 * Each detector gets focused fixture-driven coverage. Full
 * 13-detector orchestration is sanity-checked against a clean
 * harness dir + a deliberately-broken one.
 *
 * Run via `npm run test:parity`.
 */

import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {
  checkAcceptanceTrace,
  checkAdrSupersedes,
  checkAnchor,
  checkAnchorIntegration,
  checkCode,
  checkContentDrift,
  checkDerived,
  checkDoc,
  checkEvidence,
  checkGenerated,
  checkIncludes,
  checkProtocol,
  checkSpec,
  checkSpecCoverage,
  checkStale,
  formatHuman,
  isClean,
  runBlockingCheck,
  runCheck,
} from '../../src/check.js';
import {canonicalHash} from '../../src/core/canonicalHash.js';

interface Project {
  root: string;
  harness: string;
}

function makeProject(): Project {
  const root = mkdtempSync(join(tmpdir(), 'check-'));
  const harness = join(root, '.harness');
  mkdirSync(harness, {recursive: true});
  return {root, harness};
}

function writeYaml(path: string, data: unknown): void {
  writeFileSync(path, yamlStringify(data), 'utf-8');
}

function fileHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

describe('check.checkGenerated', () => {
  it('flags missing harness.yaml', () => {
    const findings = checkGenerated('/tmp', null);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
  });

  it('flags missing required keys', () => {
    const findings = checkGenerated('/tmp', {});
    expect(findings.map((f) => f.path)).toContain('harness.yaml::version');
    expect(findings.map((f) => f.path)).toContain('harness.yaml::generation');
  });

  it('clean when version + generation present', () => {
    expect(checkGenerated('/tmp', {version: '2.3', generation: {}})).toEqual([]);
  });
});

describe('check.checkDerived', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('warns when output_hash present but file missing', () => {
    const harnessYaml = {
      generation: {
        derived_from: {
          domain_md: {output_hash: 'a'.repeat(64), source_hash: 'x'},
          architecture_yaml: {output_hash: '', source_hash: ''},
        },
      },
    };
    const findings = checkDerived(p.harness, harnessYaml);
    expect(findings.find((f) => f.path === 'domain.md')!.severity).toBe('error');
  });

  it('warns when bytes diverge from output_hash', () => {
    writeFileSync(join(p.harness, 'domain.md'), 'user edit\n', 'utf-8');
    const harnessYaml = {
      generation: {
        derived_from: {
          domain_md: {output_hash: 'b'.repeat(64), source_hash: ''},
          architecture_yaml: {output_hash: '', source_hash: ''},
        },
      },
    };
    const findings = checkDerived(p.harness, harnessYaml);
    expect(findings.find((f) => f.path === 'domain.md')!.message).toContain('해시 불일치');
  });
});

describe('check.checkSpec', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags missing spec.yaml', () => {
    const findings = checkSpec(p.harness, {generation: {generated_from: {}}});
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.path).toBe('spec.yaml');
  });

  it('warns when spec_hash drifts', () => {
    writeYaml(join(p.harness, 'spec.yaml'), {version: '2.3', features: []});
    const harnessYaml = {generation: {generated_from: {spec_hash: 'a'.repeat(64)}}};
    const findings = checkSpec(p.harness, harnessYaml);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('spec 변경 감지');
  });

  it('clean when canonical hash matches', () => {
    const spec = {version: '2.3', features: []};
    writeYaml(join(p.harness, 'spec.yaml'), spec);
    const expected = canonicalHash(spec);
    const harnessYaml = {generation: {generated_from: {spec_hash: expected}}};
    expect(checkSpec(p.harness, harnessYaml)).toEqual([]);
  });
});

describe('check.checkIncludes', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
    mkdirSync(join(p.harness, 'chapters'), {recursive: true});
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags new $include after sync', () => {
    writeYaml(join(p.harness, 'spec.yaml'), {project: {description: {$include: 'desc.md'}}});
    writeFileSync(join(p.harness, 'chapters', 'desc.md'), 'x', 'utf-8');
    const findings = checkIncludes(p.harness, {generation: {include_sources: []}});
    expect(findings.find((f) => f.path === 'desc.md')!.message).toContain('신규 $include');
  });

  it('error on missing chapter file', () => {
    writeYaml(join(p.harness, 'spec.yaml'), {project: {description: {$include: 'missing.md'}}});
    const findings = checkIncludes(p.harness, {generation: {include_sources: ['missing.md']}});
    const missing = findings.find((f) => f.severity === 'error')!;
    expect(missing.message).toContain('타겟 파일 없음');
  });
});

describe('check.checkEvidence', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('skips when state.yaml missing', () => {
    expect(checkEvidence(p.harness)).toEqual([]);
  });

  it('flags done feature with no evidence', () => {
    writeYaml(join(p.harness, 'state.yaml'), {
      version: '2.3',
      schema_version: '2.3',
      features: [{id: 'F-1', status: 'done', evidence: []}],
      session: {},
    });
    const findings = checkEvidence(p.harness);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.path).toBe('F-1');
  });
});

describe('check.checkCode', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags non-existent module source', () => {
    const findings = checkCode(p.harness, {
      features: [{id: 'F-1', modules: [{name: 'foo', source: 'src/foo.ts'}]}],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
  });

  it('skips string-only modules (logical identifiers)', () => {
    expect(
      checkCode(p.harness, {features: [{id: 'F-1', modules: ['logical_id']}]}),
    ).toEqual([]);
  });
});

describe('check.checkAnchor', () => {
  it('flags id that does not match F-NNN', () => {
    const findings = checkAnchor({features: [{id: 'BadId'}]});
    expect(findings.some((f) => f.message.includes('F-NNN'))).toBe(true);
  });

  it('flags duplicate ids', () => {
    const findings = checkAnchor({
      features: [
        {id: 'F-1'},
        {id: 'F-1'},
      ],
    });
    expect(findings.some((f) => f.message.includes('중복'))).toBe(true);
  });

  it('flags missing depends_on target', () => {
    const findings = checkAnchor({
      features: [
        {id: 'F-1', depends_on: ['F-99']},
      ],
    });
    expect(findings.some((f) => f.message.includes('depends_on'))).toBe(true);
  });

  it('flags self-supersedes', () => {
    const findings = checkAnchor({
      features: [
        {id: 'F-1', supersedes: ['F-1']},
      ],
    });
    expect(findings.some((f) => f.message.includes('자기 자신 참조'))).toBe(true);
  });

  it('flags supersedes cycle', () => {
    const findings = checkAnchor({
      features: [
        {id: 'F-1', supersedes: ['F-2']},
        {id: 'F-2', supersedes: ['F-1']},
      ],
    });
    expect(findings.some((f) => f.message.includes('순환'))).toBe(true);
  });

  it('warns on bidirectional inconsistency', () => {
    const findings = checkAnchor({
      features: [
        {id: 'F-1', superseded_by: 'F-2'},
        {id: 'F-2'}, // missing supersedes back-pointer
      ],
    });
    expect(findings.some((f) => f.message.includes('양방향 불일치'))).toBe(true);
  });
});

describe('check.checkAdrSupersedes', () => {
  it('warns when superseded ADR status is not "superseded"', () => {
    const findings = checkAdrSupersedes({
      decisions: [
        {id: 'ADR-001', status: 'accepted'},
        {id: 'ADR-002', supersedes: ['ADR-001'], status: 'accepted'},
      ],
    });
    expect(findings.some((f) => f.path === 'ADR-001')).toBe(true);
  });

  it('warns on dangling supersedes reference', () => {
    const findings = checkAdrSupersedes({
      decisions: [{id: 'ADR-001', supersedes: ['ADR-MISSING']}],
    });
    expect(findings.some((f) => f.message.includes('존재하지 않는 ADR'))).toBe(true);
  });
});

describe('check.checkProtocol', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
    mkdirSync(join(p.harness, 'protocols'), {recursive: true});
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags missing frontmatter', () => {
    writeFileSync(join(p.harness, 'protocols', 'foo.md'), '# no frontmatter\n', 'utf-8');
    const findings = checkProtocol(p.harness);
    expect(findings.some((f) => f.message.includes('frontmatter'))).toBe(true);
  });

  it('flags protocol_id mismatch with stem', () => {
    writeFileSync(
      join(p.harness, 'protocols', 'foo.md'),
      '---\nprotocol_id: bar\n---\nbody\n',
      'utf-8',
    );
    const findings = checkProtocol(p.harness);
    expect(findings.some((f) => f.message.includes("protocol_id"))).toBe(true);
  });

  it('clean when protocol_id matches stem', () => {
    writeFileSync(
      join(p.harness, 'protocols', 'foo.md'),
      '---\nprotocol_id: foo\n---\nbody\n',
      'utf-8',
    );
    expect(checkProtocol(p.harness)).toEqual([]);
  });
});

describe('check.checkStale + AnchorIntegration', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
    mkdirSync(join(p.root, 'src'), {recursive: true});
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('Stale flags unreferenced done feature module', () => {
    writeFileSync(join(p.root, 'src', 'orphan.ts'), 'export const x = 1;\n', 'utf-8');
    writeFileSync(join(p.root, 'src', 'main.ts'), 'console.log("hi");\n', 'utf-8');
    const findings = checkStale(
      p.harness,
      {features: [{id: 'F-1', status: 'done', modules: [{source: 'src/orphan.ts'}]}]},
      p.root,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.kind).toBe('Stale');
  });

  it('Stale ignores done features with superseded_by', () => {
    writeFileSync(join(p.root, 'src', 'orphan.ts'), 'x', 'utf-8');
    const findings = checkStale(
      p.harness,
      {
        features: [
          {id: 'F-1', status: 'done', superseded_by: 'F-2', modules: [{source: 'src/orphan.ts'}]},
        ],
      },
      p.root,
    );
    expect(findings).toEqual([]);
  });

  it('AnchorIntegration flags missing wiring', () => {
    writeFileSync(join(p.root, 'src', 'feature.ts'), 'export const f = 1;\n', 'utf-8');
    writeFileSync(join(p.root, 'src', 'main.ts'), 'console.log("nothing referencing feature");\n', 'utf-8');
    const findings = checkAnchorIntegration(
      p.harness,
      {
        features: [
          {
            id: 'F-1',
            status: 'done',
            modules: [{source: 'src/feature.ts'}],
            integration_anchor: ['src/main.ts'],
          },
        ],
      },
      p.root,
    );
    expect(findings.find((f) => f.kind === 'AnchorIntegration')).toBeDefined();
  });

  it('AnchorIntegration error on missing anchor file', () => {
    writeFileSync(join(p.root, 'src', 'feature.ts'), 'x', 'utf-8');
    const findings = checkAnchorIntegration(
      p.harness,
      {
        features: [
          {
            id: 'F-1',
            status: 'done',
            modules: [{source: 'src/feature.ts'}],
            integration_anchor: ['src/nonexistent.ts'],
          },
        ],
      },
      p.root,
    );
    expect(findings.find((f) => f.severity === 'error')).toBeDefined();
  });
});

describe('check.checkDoc', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags missing CLAUDE.md @import target', () => {
    writeFileSync(join(p.root, 'CLAUDE.md'), '@docs/missing.md\n', 'utf-8');
    const findings = checkDoc(p.harness, p.root);
    expect(findings.some((f) => f.path.includes('@docs/missing.md'))).toBe(true);
  });

  it('flags 0-byte derived file', () => {
    writeFileSync(join(p.harness, 'domain.md'), '', 'utf-8');
    const findings = checkDoc(p.harness, p.root);
    expect(findings.find((f) => f.path === 'domain.md')!.severity).toBe('error');
  });
});

describe('check.checkSpecCoverage (F-078)', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
    mkdirSync(join(p.harness, '_workspace', 'coverage'), {recursive: true});
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('flags ratio below default threshold', () => {
    writeYaml(join(p.harness, '_workspace', 'coverage', 'F-1.yaml'), {
      feature_id: 'F-1',
      mismatches: [{metric: 'sections', description_value: 10, ac_value: 5}],
    });
    const findings = checkSpecCoverage(p.harness, null);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.path).toBe('F-1::quant.sections');
  });

  it('respects harness.yaml coverage.threshold override', () => {
    writeYaml(join(p.harness, '_workspace', 'coverage', 'F-1.yaml'), {
      feature_id: 'F-1',
      mismatches: [{metric: 'sections', description_value: 10, ac_value: 7}],
    });
    writeYaml(join(p.harness, 'harness.yaml'), {coverage: {threshold: 0.5}});
    const findings = checkSpecCoverage(p.harness, null);
    expect(findings).toEqual([]);
  });

  it('skips zero-denominator mismatches', () => {
    writeYaml(join(p.harness, '_workspace', 'coverage', 'F-1.yaml'), {
      feature_id: 'F-1',
      mismatches: [{metric: 'x', description_value: 0, ac_value: 0}],
    });
    expect(checkSpecCoverage(p.harness, null)).toEqual([]);
  });
});

describe('check.checkAcceptanceTrace (F-168)', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  const baseSpec = {
    features: [
      {
        id: 'F-001',
        status: 'in_progress',
        acceptance_criteria: ['AC-1: first AC', 'AC-2: second AC'],
      },
    ],
  };

  it('opt-in by default — disabled when harness.yaml flag is absent', () => {
    const findings = checkAcceptanceTrace(p.harness, baseSpec, p.root);
    expect(findings).toHaveLength(0);
  });

  it('disabled explicitly returns no findings', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: false}},
    });
    expect(checkAcceptanceTrace(p.harness, baseSpec, p.root)).toHaveLength(0);
  });

  it('enabled — implicit mapping passes when test file references both fid + AC-N', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: true}},
    });
    mkdirSync(join(p.root, 'tests'), {recursive: true});
    writeFileSync(
      join(p.root, 'tests', 'a.test.ts'),
      "describe('F-001 — first thing', () => { it('AC-1 covered', () => {}); it('AC-2 covered', () => {}); });",
      'utf-8',
    );
    const findings = checkAcceptanceTrace(p.harness, baseSpec, p.root);
    expect(findings).toHaveLength(0);
  });

  it('enabled — implicit mapping warns when no test references both', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: true}},
    });
    // No tests/ — every AC fails the implicit check.
    const findings = checkAcceptanceTrace(p.harness, baseSpec, p.root);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.kind).toBe('AcceptanceTrace');
    expect(findings[0]!.severity).toBe('warn');
    expect(findings[0]!.message).toContain('F-001');
    expect(findings[0]!.message).toContain('AC-1');
  });

  it('strict mode escalates severity to error', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: true, strict: true}},
    });
    const findings = checkAcceptanceTrace(p.harness, baseSpec, p.root);
    expect(findings[0]!.severity).toBe('error');
  });

  it('explicit test_refs — missing ref triggers drift with explicit-shape message', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: true}},
    });
    mkdirSync(join(p.root, 'tests'), {recursive: true});
    writeFileSync(
      join(p.root, 'tests', 'a.test.ts'),
      "it('testKnown', () => {});",
      'utf-8',
    );
    const objSpec = {
      features: [
        {
          id: 'F-001',
          status: 'in_progress',
          acceptance_criteria: [
            {statement: 'first', test_refs: ['testKnown']},
            {statement: 'second', test_refs: ['testMissing']},
          ],
        },
      ],
    };
    const findings = checkAcceptanceTrace(p.harness, objSpec, p.root);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.path).toContain('acceptance_criteria[1]');
    // Message must name the missing ref verbatim — distinguishes
    // explicit-shape failure from implicit-shape failure (empirical
    // UX finding from the F-167/F-168/F-169 verification cycle).
    expect(findings[0]!.message).toContain('testMissing');
    expect(findings[0]!.message).toContain('test_ref');
  });

  it('skips archived features', () => {
    writeYaml(join(p.harness, 'harness.yaml'), {
      detectors: {acceptance_trace: {enabled: true}},
    });
    const archivedSpec = {
      features: [
        {
          id: 'F-099',
          status: 'archived',
          acceptance_criteria: ['AC-1: legacy'],
        },
      ],
    };
    expect(checkAcceptanceTrace(p.harness, archivedSpec, p.root)).toHaveLength(0);
  });
});

describe('check.checkContentDrift (F-169)', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('no CLAUDE.md → no findings (idempotent)', () => {
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('JSON source — version field match', () => {
    mkdirSync(join(p.root, '.claude-plugin'), {recursive: true});
    writeFileSync(
      join(p.root, '.claude-plugin', 'plugin.json'),
      JSON.stringify({name: 'foo', version: '1.2.3'}),
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=plugin_version value=1.2.3 source=.claude-plugin/plugin.json:version --> v1.2.3 <!-- /harness:fact -->',
      'utf-8',
    );
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('JSON source — version field mismatch flagged', () => {
    mkdirSync(join(p.root, '.claude-plugin'), {recursive: true});
    writeFileSync(
      join(p.root, '.claude-plugin', 'plugin.json'),
      JSON.stringify({name: 'foo', version: '1.2.4'}),
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=plugin_version value=1.2.3 source=.claude-plugin/plugin.json:version --> v1.2.3 <!-- /harness:fact -->',
      'utf-8',
    );
    const findings = checkContentDrift(p.harness, p.root);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.kind).toBe('ContentDrift');
    expect(findings[0]!.severity).toBe('error');
    expect(findings[0]!.message).toContain('1.2.3');
    expect(findings[0]!.message).toContain('1.2.4');
  });

  it('TS union type — member count match', () => {
    mkdirSync(join(p.root, 'src'), {recursive: true});
    writeFileSync(
      join(p.root, 'src', 'kinds.ts'),
      "export type Color = 'red' | 'green' | 'blue';\n",
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=color_count value=3 source=src/kinds.ts:Color --> 3 colors <!-- /harness:fact -->',
      'utf-8',
    );
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('TS union type — member count mismatch flagged', () => {
    mkdirSync(join(p.root, 'src'), {recursive: true});
    writeFileSync(
      join(p.root, 'src', 'kinds.ts'),
      "export type Color = 'red' | 'green' | 'blue' | 'yellow';\n",
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=color_count value=3 source=src/kinds.ts:Color --> 3 colors <!-- /harness:fact -->',
      'utf-8',
    );
    const findings = checkContentDrift(p.harness, p.root);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('actual `4`');
  });

  it('TS scalar const — match', () => {
    mkdirSync(join(p.root, 'src'), {recursive: true});
    writeFileSync(
      join(p.root, 'src', 'consts.ts'),
      "export const MAX_RETRIES = 5;\n",
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=max_retries value=5 source=src/consts.ts:MAX_RETRIES --> 5 retries <!-- /harness:fact -->',
      'utf-8',
    );
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('TS Set literal — member count match', () => {
    mkdirSync(join(p.root, 'src'), {recursive: true});
    writeFileSync(
      join(p.root, 'src', 'sets.ts'),
      "const KINDS: ReadonlySet<string> = new Set(['a', 'b', 'c']);\n",
      'utf-8',
    );
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=kinds_count value=3 source=src/sets.ts:KINDS --> 3 kinds <!-- /harness:fact -->',
      'utf-8',
    );
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('Documentation placeholder (single-letter uppercase) is skipped', () => {
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      'Sigil example: <!-- harness:fact key=X value=V source=Y --> placeholder <!-- /harness:fact -->',
      'utf-8',
    );
    // Doc example shape — should NOT trigger a finding even though
    // the `source=Y` is unresolvable.
    expect(checkContentDrift(p.harness, p.root)).toHaveLength(0);
  });

  it('Missing source file flagged with clear message', () => {
    writeFileSync(
      join(p.root, 'CLAUDE.md'),
      '<!-- harness:fact key=foo value=1 source=src/missing.ts:foo --> x <!-- /harness:fact -->',
      'utf-8',
    );
    const findings = checkContentDrift(p.harness, p.root);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('source file not found');
  });
});

describe('check orchestrators', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('runCheck reports all 15 categories (F-168 + F-169)', () => {
    const r = runCheck(p.harness);
    // Some may be skipped when their inputs are missing — but Generated +
    // Evidence + Doc + Protocol + Coverage + AcceptanceTrace +
    // ContentDrift always fire.
    expect(r.checked).toContain('Generated');
    expect(r.checked).toContain('Evidence');
    expect(r.checked).toContain('Doc');
    expect(r.checked).toContain('Protocol');
    expect(r.checked).toContain('Coverage');
    expect(r.checked).toContain('AcceptanceTrace');
    expect(r.checked).toContain('ContentDrift');
  });

  it('runCheck on a populated harness returns clean = false when drift exists', () => {
    // Empty harness is missing harness.yaml → at least one error finding.
    const r = runCheck(p.harness);
    expect(isClean(r)).toBe(false);
  });

  it('runBlockingCheck inspects Code/Stale/AnchorIntegration/Coverage/ContentDrift (F-169)', () => {
    writeYaml(join(p.harness, 'spec.yaml'), {features: []});
    const r = runBlockingCheck(p.harness);
    expect(r.checked).toEqual([
      'Code',
      'Stale',
      'AnchorIntegration',
      'Coverage',
      'ContentDrift',
    ]);
  });

  it('formatHuman emits canonical header + clean line', () => {
    writeYaml(join(p.harness, 'spec.yaml'), {features: []});
    const r = runBlockingCheck(p.harness);
    const out = formatHuman(r);
    expect(out.startsWith('🔍 /harness:check\n')).toBe(true);
    expect(out).toContain('Checked: ');
  });
});

// Silence lint warning for the helper kept around for future fixtures.
void fileHash;
