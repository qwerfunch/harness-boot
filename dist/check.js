/**
 * `/harness:check` drift detection (F-100 port of `scripts/check.py`).
 *
 * Read-only / CQS — never modifies any harness file or project file.
 *
 * 13 drift kinds:
 *
 *   1. Generated         — harness.yaml structural integrity.
 *   2. Derived           — domain.md / architecture.yaml output_hash
 *      vs current file hash (edit-wins detection).
 *   3. Spec              — spec.yaml canonical hash vs harness.yaml
 *      generated_from.spec_hash.
 *   4. Include           — harness.yaml include_sources vs current
 *      spec.yaml $include nodes.
 *   5. Evidence          — done features must declare ≥1 evidence.
 *   6. Code              — features[].modules[].source must exist.
 *   7. Doc               — CLAUDE.md @import targets exist; derived
 *      files non-empty.
 *   8. Anchor            — feature id format/uniqueness, depends_on
 *      validity, supersedes/superseded_by consistency.
 *   9. Protocol          — protocols/*.md frontmatter.protocol_id
 *      matches file stem.
 *  10. Adr               — decisions[].supersedes target status must
 *      be `superseded`.
 *  11. Stale             — done features whose modules are unreferenced.
 *  12. AnchorIntegration — done features must be wired into their
 *      integration_anchor.
 *  13. Coverage          — quant fingerprint mismatches below threshold.
 *
 * @module check
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { canonicalHash } from './core/canonicalHash.js';
import { State } from './core/state.js';
import { findIncludes } from './spec/includeExpander.js';
const FEATURE_ID_PATTERN = /^F-\d+$/;
const CLAUDE_IMPORT_PATTERN = /^@([^\s]+)/gm;
const PROTOCOL_FRONTMATTER = /^---\s*\n([\s\S]*?)\n---/;
/** True when no findings were emitted. */
export function isClean(report) {
    return report.findings.length === 0;
}
/** Default coverage ratio threshold (matches Python `_DEFAULT_COVERAGE_THRESHOLD`). */
export const DEFAULT_COVERAGE_THRESHOLD = 0.8;
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function fileSha256(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function loadYamlFile(path) {
    if (!isFile(path)) {
        return null;
    }
    try {
        const parsed = yamlParse(readFileSync(path, 'utf-8'));
        return isPlainObject(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
/** Recursively walks a directory, returning every regular file path. */
function walkFiles(root) {
    const out = [];
    let entries;
    try {
        entries = readdirSync(root);
    }
    catch {
        return out;
    }
    for (const name of entries) {
        const full = join(root, name);
        let stat;
        try {
            stat = statSync(full);
        }
        catch {
            continue;
        }
        if (stat.isDirectory()) {
            out.push(...walkFiles(full));
        }
        else if (stat.isFile()) {
            out.push(full);
        }
    }
    return out;
}
// --------------------------------------------------------------------
// Generated drift
// --------------------------------------------------------------------
/** harness.yaml structural integrity check. */
export function checkGenerated(_harnessDir, harnessYaml) {
    const findings = [];
    if (harnessYaml === null) {
        findings.push({
            kind: 'Generated',
            path: 'harness.yaml',
            message: 'harness.yaml 부재/로드 실패',
            severity: 'error',
        });
        return findings;
    }
    for (const key of ['version', 'generation']) {
        if (!(key in harnessYaml)) {
            findings.push({
                kind: 'Generated',
                path: `harness.yaml::${key}`,
                message: `필수 키 누락: ${key}`,
                severity: 'error',
            });
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Derived drift
// --------------------------------------------------------------------
/** Compares output_hash against actual file hash for derived outputs. */
export function checkDerived(harnessDir, harnessYaml) {
    const findings = [];
    const generation = isPlainObject(harnessYaml['generation']) ? harnessYaml['generation'] : {};
    const derived = isPlainObject(generation['derived_from'])
        ? generation['derived_from']
        : {};
    const mapping = [
        ['domain_md', 'domain.md'],
        ['architecture_yaml', 'architecture.yaml'],
    ];
    for (const [key, filename] of mapping) {
        const entry = isPlainObject(derived[key]) ? derived[key] : {};
        const expected = entry['output_hash'];
        const path = join(harnessDir, filename);
        if (!isFile(path)) {
            if (typeof expected === 'string' && expected.length > 0) {
                findings.push({
                    kind: 'Derived',
                    path: filename,
                    message: `${filename} 기록된 해시 있으나 파일 없음`,
                    severity: 'error',
                });
            }
            continue;
        }
        if (typeof expected !== 'string' || expected.length === 0) {
            findings.push({
                kind: 'Derived',
                path: filename,
                message: `${filename} 존재하지만 output_hash 미기록 (sync 필요)`,
                severity: 'warn',
            });
            continue;
        }
        const actual = fileSha256(path);
        if (actual !== expected) {
            findings.push({
                kind: 'Derived',
                path: filename,
                message: `${filename} 해시 불일치 (edit-wins 감지) — sync --force 로 재생성 or 수동 수정 reconcile 필요`,
                severity: 'warn',
            });
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Spec drift
// --------------------------------------------------------------------
/** Compares spec.yaml canonical hash against harness.yaml's recorded hash. */
export function checkSpec(harnessDir, harnessYaml) {
    const findings = [];
    const specPath = join(harnessDir, 'spec.yaml');
    if (!isFile(specPath)) {
        findings.push({
            kind: 'Spec',
            path: 'spec.yaml',
            message: 'spec.yaml 부재',
            severity: 'error',
        });
        return findings;
    }
    const generation = isPlainObject(harnessYaml['generation']) ? harnessYaml['generation'] : {};
    const generatedFrom = isPlainObject(generation['generated_from'])
        ? generation['generated_from']
        : {};
    const expected = generatedFrom['spec_hash'];
    if (typeof expected !== 'string' || expected.length === 0) {
        findings.push({
            kind: 'Spec',
            path: 'spec.yaml',
            message: 'harness.yaml 에 spec_hash 미기록 (sync 필요)',
            severity: 'warn',
        });
        return findings;
    }
    let parsed;
    try {
        parsed = yamlParse(readFileSync(specPath, 'utf-8'));
    }
    catch {
        parsed = {};
    }
    const actual = canonicalHash(parsed ?? {});
    if (actual !== expected) {
        findings.push({
            kind: 'Spec',
            path: 'spec.yaml',
            message: `spec 변경 감지 — sync 필요 (expected=${expected.slice(0, 12)}, actual=${actual.slice(0, 12)})`,
            severity: 'warn',
        });
    }
    return findings;
}
// --------------------------------------------------------------------
// Include drift
// --------------------------------------------------------------------
/** Verifies recorded includes still match spec.yaml + chapter files exist. */
export function checkIncludes(harnessDir, harnessYaml) {
    const findings = [];
    const generation = isPlainObject(harnessYaml['generation']) ? harnessYaml['generation'] : {};
    const recorded = asArray(generation['include_sources']).filter((x) => typeof x === 'string');
    const specPath = join(harnessDir, 'spec.yaml');
    let current = [];
    if (isFile(specPath)) {
        try {
            const parsed = yamlParse(readFileSync(specPath, 'utf-8'));
            if (isPlainObject(parsed)) {
                current = findIncludes(parsed).map((item) => item.target);
            }
        }
        catch {
            current = [];
        }
    }
    const recSet = new Set(recorded);
    const curSet = new Set(current);
    const removed = [...recSet].filter((x) => !curSet.has(x)).sort();
    const added = [...curSet].filter((x) => !recSet.has(x)).sort();
    for (const item of added) {
        findings.push({
            kind: 'Include',
            path: item,
            message: `spec 에 신규 $include 감지 (sync 필요): ${item}`,
            severity: 'warn',
        });
    }
    for (const item of removed) {
        findings.push({
            kind: 'Include',
            path: item,
            message: `harness.yaml 에 기록된 include 가 spec 에서 사라짐: ${item}`,
            severity: 'warn',
        });
    }
    const chaptersDir = join(harnessDir, 'chapters');
    if (isDirectory(chaptersDir)) {
        for (const target of current) {
            if (!isFile(join(chaptersDir, target))) {
                findings.push({
                    kind: 'Include',
                    path: target,
                    message: `$include 타겟 파일 없음: chapters/${target}`,
                    severity: 'error',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Evidence drift
// --------------------------------------------------------------------
/** Done features must carry ≥1 evidence entry. */
export function checkEvidence(harnessDir) {
    const findings = [];
    const statePath = join(harnessDir, 'state.yaml');
    if (!isFile(statePath)) {
        return findings;
    }
    const state = State.load(harnessDir);
    for (const f of state.data.features) {
        if (!isPlainObject(f)) {
            continue;
        }
        if (f['status'] === 'done' && (!Array.isArray(f['evidence']) || f['evidence'].length === 0)) {
            const fid = typeof f['id'] === 'string' ? f['id'] : '?';
            findings.push({
                kind: 'Evidence',
                path: fid,
                message: `피처 ${fid} 가 done 이지만 evidence 미기록 (BR-004 가이드)`,
                severity: 'warn',
            });
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Code drift
// --------------------------------------------------------------------
/** features[].modules[].source must point to an existing file. */
export function checkCode(harnessDir, spec, projectRoot = null) {
    const findings = [];
    const root = projectRoot ?? resolvePath(harnessDir, '..');
    const features = asArray(spec['features']);
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        const modules = asArray(f['modules']);
        for (const m of modules) {
            if (!isPlainObject(m)) {
                continue;
            }
            const src = m['source'];
            if (typeof src !== 'string' || src.trim().length === 0) {
                continue;
            }
            const target = resolvePath(root, src);
            if (!isFile(target)) {
                const name = typeof m['name'] === 'string' ? m['name'] : '?';
                findings.push({
                    kind: 'Code',
                    path: `${fid}::${name}`,
                    message: `모듈 '${name}' 의 source 경로 부재: ${src}`,
                    severity: 'error',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Doc drift
// --------------------------------------------------------------------
/** CLAUDE.md @imports must resolve; derived files non-empty. */
export function checkDoc(harnessDir, projectRoot = null) {
    const findings = [];
    const root = projectRoot ?? resolvePath(harnessDir, '..');
    const claudeMd = join(root, 'CLAUDE.md');
    if (isFile(claudeMd)) {
        let text = '';
        try {
            text = readFileSync(claudeMd, 'utf-8');
        }
        catch {
            text = '';
        }
        let match;
        CLAUDE_IMPORT_PATTERN.lastIndex = 0;
        while ((match = CLAUDE_IMPORT_PATTERN.exec(text)) !== null) {
            const rel = match[1].trim().replace(/[.,;:)]+$/, '');
            if (!rel || rel.startsWith('http://') || rel.startsWith('https://')) {
                continue;
            }
            const target = isAbsolute(rel) ? rel : resolvePath(root, rel);
            try {
                statSync(target);
            }
            catch {
                findings.push({
                    kind: 'Doc',
                    path: `CLAUDE.md::@${rel}`,
                    message: `CLAUDE.md @import 타겟 부재: ${rel}`,
                    severity: 'warn',
                });
            }
        }
    }
    for (const fname of ['domain.md', 'architecture.yaml']) {
        const path = join(harnessDir, fname);
        if (isFile(path)) {
            try {
                if (statSync(path).size === 0) {
                    findings.push({
                        kind: 'Doc',
                        path: fname,
                        message: `${fname} 파일이 비어있음 — sync 재생성 필요`,
                        severity: 'error',
                    });
                }
            }
            catch {
                // ignore
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Anchor drift
// --------------------------------------------------------------------
/** Feature id format / uniqueness / depends_on / supersedes consistency. */
export function checkAnchor(spec) {
    const findings = [];
    const features = asArray(spec['features']);
    const seen = new Set();
    const allIds = new Set();
    features.forEach((f, i) => {
        if (!isPlainObject(f)) {
            findings.push({
                kind: 'Anchor',
                path: `features[${i}]`,
                message: 'feature 항목이 매핑이 아님',
                severity: 'error',
            });
            return;
        }
        const fid = f['id'];
        if (typeof fid !== 'string' || fid.length === 0) {
            findings.push({
                kind: 'Anchor',
                path: `features[${i}]`,
                message: 'feature id 누락',
                severity: 'error',
            });
            return;
        }
        if (!FEATURE_ID_PATTERN.test(fid)) {
            findings.push({
                kind: 'Anchor',
                path: fid,
                message: `feature id 가 F-NNN 패턴이 아님 (got: '${fid}')`,
                severity: 'error',
            });
        }
        if (seen.has(fid)) {
            findings.push({
                kind: 'Anchor',
                path: fid,
                message: `중복 feature id: ${fid}`,
                severity: 'error',
            });
        }
        seen.add(fid);
        allIds.add(fid);
    });
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        const deps = f['depends_on'];
        if (deps === undefined || deps === null) {
            continue;
        }
        if (!Array.isArray(deps)) {
            findings.push({
                kind: 'Anchor',
                path: fid,
                message: 'depends_on 이 배열이 아님',
                severity: 'error',
            });
            continue;
        }
        for (const dep of deps) {
            if (typeof dep !== 'string') {
                findings.push({
                    kind: 'Anchor',
                    path: fid,
                    message: `depends_on 항목이 문자열 아님: ${JSON.stringify(dep)}`,
                    severity: 'error',
                });
                continue;
            }
            if (!allIds.has(dep)) {
                findings.push({
                    kind: 'Anchor',
                    path: fid,
                    message: `depends_on 에 존재하지 않는 피처 참조: ${dep}`,
                    severity: 'error',
                });
            }
        }
    }
    findings.push(...checkFeatureSupersedes(features, allIds));
    return findings;
}
function checkFeatureSupersedes(features, allIds) {
    const findings = [];
    const supersedesMap = new Map();
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = f['id'];
        if (typeof fid !== 'string' || fid.length === 0) {
            continue;
        }
        const sup = f['supersedes'];
        if (sup === undefined || sup === null) {
            supersedesMap.set(fid, []);
        }
        else if (!Array.isArray(sup)) {
            findings.push({
                kind: 'Anchor',
                path: fid,
                message: 'supersedes 가 배열이 아님',
                severity: 'error',
            });
            supersedesMap.set(fid, []);
        }
        else {
            const cleaned = [];
            for (const target of sup) {
                if (typeof target !== 'string') {
                    findings.push({
                        kind: 'Anchor',
                        path: fid,
                        message: `supersedes 항목이 문자열 아님: ${JSON.stringify(target)}`,
                        severity: 'error',
                    });
                    continue;
                }
                if (target === fid) {
                    findings.push({
                        kind: 'Anchor',
                        path: fid,
                        message: `supersedes 에 자기 자신 참조 금지: ${target}`,
                        severity: 'error',
                    });
                    continue;
                }
                if (!allIds.has(target)) {
                    findings.push({
                        kind: 'Anchor',
                        path: fid,
                        message: `supersedes 에 존재하지 않는 피처 참조: ${target}`,
                        severity: 'error',
                    });
                    continue;
                }
                cleaned.push(target);
            }
            supersedesMap.set(fid, cleaned);
        }
        const sb = f['superseded_by'];
        if (sb !== undefined && sb !== null) {
            if (typeof sb !== 'string') {
                findings.push({
                    kind: 'Anchor',
                    path: fid,
                    message: `superseded_by 가 문자열 아님: ${JSON.stringify(sb)}`,
                    severity: 'error',
                });
            }
            else if (sb === fid) {
                findings.push({
                    kind: 'Anchor',
                    path: fid,
                    message: `superseded_by 에 자기 자신 참조 금지: ${sb}`,
                    severity: 'error',
                });
            }
            else if (!allIds.has(sb)) {
                findings.push({
                    kind: 'Anchor',
                    path: fid,
                    message: `superseded_by 에 존재하지 않는 피처 참조: ${sb}`,
                    severity: 'error',
                });
            }
        }
    }
    // Cycle detection — DFS WHITE/GRAY/BLACK.
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    for (const fid of supersedesMap.keys()) {
        color.set(fid, WHITE);
    }
    const visit = (node, stack) => {
        color.set(node, GRAY);
        for (const nxt of supersedesMap.get(node) ?? []) {
            const c = color.get(nxt);
            if (c === GRAY) {
                const cycle = [...stack, node, nxt];
                findings.push({
                    kind: 'Anchor',
                    path: node,
                    message: `supersedes 순환 감지: ${cycle.join(' → ')}`,
                    severity: 'error',
                });
                continue;
            }
            if (c === WHITE) {
                visit(nxt, [...stack, node]);
            }
        }
        color.set(node, BLACK);
    };
    for (const fid of supersedesMap.keys()) {
        if (color.get(fid) === WHITE) {
            visit(fid, []);
        }
    }
    // Bidirectional consistency check.
    const byId = new Map();
    for (const f of features) {
        if (isPlainObject(f) && typeof f['id'] === 'string') {
            byId.set(f['id'], f);
        }
    }
    for (const [fid, feat] of byId.entries()) {
        const sb = feat['superseded_by'];
        if (typeof sb !== 'string' || !byId.has(sb)) {
            continue;
        }
        const targetSup = asArray(byId.get(sb)['supersedes']);
        if (!targetSup.includes(fid)) {
            findings.push({
                kind: 'Anchor',
                path: fid,
                message: `${fid}.superseded_by=${sb} 이지만 ${sb}.supersedes 에 ${fid} 없음 — 양방향 불일치`,
                severity: 'warn',
            });
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Adr drift
// --------------------------------------------------------------------
/** decisions[].supersedes target ADR status must be `superseded`. */
export function checkAdrSupersedes(spec) {
    const findings = [];
    const decisions = asArray(spec['decisions']);
    if (decisions.length === 0) {
        return findings;
    }
    const byId = new Map();
    for (const d of decisions) {
        if (isPlainObject(d) && typeof d['id'] === 'string') {
            byId.set(d['id'], d);
        }
    }
    for (const d of decisions) {
        if (!isPlainObject(d)) {
            continue;
        }
        const newId = typeof d['id'] === 'string' ? d['id'] : '?';
        const supersedes = asArray(d['supersedes']);
        for (const target of supersedes) {
            if (typeof target !== 'string') {
                continue;
            }
            const targetD = byId.get(target);
            if (targetD === undefined) {
                findings.push({
                    kind: 'Adr',
                    path: newId,
                    message: `supersedes 에 존재하지 않는 ADR 참조: ${target} (decisions[] 에 없음)`,
                    severity: 'warn',
                });
                continue;
            }
            const status = targetD['status'];
            if (status !== 'superseded') {
                findings.push({
                    kind: 'Adr',
                    path: target,
                    message: `${newId} 가 ${target} 를 supersedes 하나 ${target}.status=${JSON.stringify(status)} — 'superseded' 로 갱신 필요`,
                    severity: 'warn',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Protocol drift
// --------------------------------------------------------------------
/** protocols/*.md frontmatter.protocol_id must match the file stem. */
export function checkProtocol(harnessDir) {
    const findings = [];
    const protoDir = join(harnessDir, 'protocols');
    if (!isDirectory(protoDir)) {
        return findings;
    }
    let entries;
    try {
        entries = readdirSync(protoDir).sort();
    }
    catch {
        return findings;
    }
    for (const name of entries) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const md = join(protoDir, name);
        let text;
        try {
            text = readFileSync(md, 'utf-8');
        }
        catch {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: '파일 읽기 실패',
                severity: 'error',
            });
            continue;
        }
        const match = PROTOCOL_FRONTMATTER.exec(text);
        if (match === null) {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: 'YAML frontmatter 부재 — `---` 로 시작/종료되는 블록 필요',
                severity: 'error',
            });
            continue;
        }
        let fm;
        try {
            fm = yamlParse(match[1]);
        }
        catch (err) {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: `frontmatter YAML 파싱 실패: ${err.message}`,
                severity: 'error',
            });
            continue;
        }
        if (!isPlainObject(fm)) {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: 'frontmatter 가 mapping 이 아님',
                severity: 'error',
            });
            continue;
        }
        const pid = fm['protocol_id'];
        if (typeof pid !== 'string' || pid.length === 0) {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: 'frontmatter.protocol_id 누락 또는 빈 값',
                severity: 'error',
            });
            continue;
        }
        const expected = name.replace(/\.md$/, '');
        if (pid !== expected) {
            findings.push({
                kind: 'Protocol',
                path: relative(harnessDir, md),
                message: `protocol_id ('${pid}') 가 파일명 stem ('${expected}') 과 불일치 — F-017 AC-2 위반`,
                severity: 'error',
            });
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Stale drift
// --------------------------------------------------------------------
/** Done feature modules unreferenced by anything in src/. */
export function checkStale(harnessDir, spec, projectRoot = null) {
    const findings = [];
    const root = projectRoot ?? resolvePath(harnessDir, '..');
    const features = asArray(spec['features']);
    const srcRoot = join(root, 'src');
    if (!isDirectory(srcRoot)) {
        return findings;
    }
    const srcFiles = walkFiles(srcRoot);
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        if (f['status'] !== 'done') {
            continue;
        }
        if (f['superseded_by']) {
            continue;
        }
        const modules = asArray(f['modules']);
        const declaredSources = [];
        for (const m of modules) {
            if (!isPlainObject(m)) {
                continue;
            }
            const src = m['source'];
            if (typeof src !== 'string' || src.trim().length === 0) {
                continue;
            }
            const target = resolvePath(root, src);
            if (isFile(target)) {
                declaredSources.push(target);
            }
        }
        if (declaredSources.length === 0) {
            continue;
        }
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        for (const target of declaredSources) {
            const base = target.split(/[/\\]/).pop();
            const stem = base.replace(/\.[^.]+$/, '');
            let referenced = false;
            for (const sf of srcFiles) {
                if (sf === target) {
                    continue;
                }
                let text;
                try {
                    text = readFileSync(sf, 'utf-8');
                }
                catch {
                    continue;
                }
                if (text.includes(base)) {
                    referenced = true;
                    break;
                }
                if (text.includes(`/${stem}`) ||
                    text.includes(`"${stem}`) ||
                    text.includes(`'${stem}`)) {
                    referenced = true;
                    break;
                }
            }
            if (!referenced) {
                let relStr;
                try {
                    relStr = relative(root, target);
                }
                catch {
                    relStr = base;
                }
                findings.push({
                    kind: 'Stale',
                    path: `${fid}::${relStr}`,
                    message: `피처 ${fid} (status=done) 의 모듈 ${relStr} 가 src/ 어디에서도 참조되지 않음 — ` +
                        '실제로 사용되지 않는 dead code 거나 archived/superseded_by 처리가 필요',
                    severity: 'warn',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// AnchorIntegration drift
// --------------------------------------------------------------------
/** Done features must be wired into their integration_anchor files. */
export function checkAnchorIntegration(harnessDir, spec, projectRoot = null) {
    const findings = [];
    const root = projectRoot ?? resolvePath(harnessDir, '..');
    const features = asArray(spec['features']);
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        if (f['status'] !== 'done') {
            continue;
        }
        if (f['superseded_by']) {
            continue;
        }
        const anchors = f['integration_anchor'];
        if (!Array.isArray(anchors) || anchors.length === 0) {
            continue;
        }
        const modules = asArray(f['modules']);
        const declaredSources = [];
        for (const m of modules) {
            if (!isPlainObject(m)) {
                continue;
            }
            const src = m['source'];
            if (typeof src !== 'string' || src.trim().length === 0) {
                continue;
            }
            const target = resolvePath(root, src);
            if (isFile(target)) {
                declaredSources.push(target);
            }
        }
        if (declaredSources.length === 0) {
            continue;
        }
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        const anchorPaths = [];
        for (const anchor of anchors) {
            if (typeof anchor !== 'string' || anchor.trim().length === 0) {
                continue;
            }
            const ap = resolvePath(root, anchor);
            if (!isFile(ap)) {
                findings.push({
                    kind: 'AnchorIntegration',
                    path: `${fid}::${anchor}`,
                    message: `피처 ${fid} 의 integration_anchor 파일 부재: ${anchor}`,
                    severity: 'error',
                });
                continue;
            }
            anchorPaths.push(ap);
        }
        if (anchorPaths.length === 0) {
            continue;
        }
        const anchorRels = anchorPaths.map((p) => {
            try {
                return relative(root, p);
            }
            catch {
                return p;
            }
        });
        const anchorList = anchorRels.join(', ');
        for (const target of declaredSources) {
            const base = target.split(/[/\\]/).pop();
            const stem = base.replace(/\.[^.]+$/, '');
            let relStr;
            try {
                relStr = relative(root, target);
            }
            catch {
                relStr = base;
            }
            let referenced = false;
            for (const ap of anchorPaths) {
                let text;
                try {
                    text = readFileSync(ap, 'utf-8');
                }
                catch {
                    continue;
                }
                if (text.includes(base)) {
                    referenced = true;
                    break;
                }
                if (text.includes(`/${stem}`) ||
                    text.includes(`"${stem}`) ||
                    text.includes(`'${stem}`)) {
                    referenced = true;
                    break;
                }
            }
            if (!referenced) {
                findings.push({
                    kind: 'AnchorIntegration',
                    path: `${fid}::${relStr}`,
                    message: `피처 ${fid} (status=done) 의 모듈 ${relStr} 가 integration_anchor (${anchorList}) ` +
                        '에서 참조되지 않음 — 통합 wiring 누락 가능성',
                    severity: 'warn',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Coverage drift (F-078)
// --------------------------------------------------------------------
/**
 * F-078 — Reads `_workspace/coverage/F-*.yaml` fingerprints and emits
 * one error finding per recorded mismatch whose `ac_value /
 * description_value` ratio falls below the threshold.
 *
 * Threshold defaults to 0.80; override via
 * `harness.yaml.coverage.threshold`.
 */
export function checkSpecCoverage(harnessDir, _specYaml) {
    const findings = [];
    const covDir = join(harnessDir, '_workspace', 'coverage');
    if (!isDirectory(covDir)) {
        return findings;
    }
    let threshold = DEFAULT_COVERAGE_THRESHOLD;
    const harnessYamlPath = join(harnessDir, 'harness.yaml');
    if (isFile(harnessYamlPath)) {
        try {
            const cfg = yamlParse(readFileSync(harnessYamlPath, 'utf-8'));
            if (isPlainObject(cfg)) {
                const coverage = cfg['coverage'];
                if (isPlainObject(coverage)) {
                    const override = coverage['threshold'];
                    if (typeof override === 'number') {
                        threshold = override;
                    }
                    else if (typeof override === 'string' && !Number.isNaN(Number(override))) {
                        threshold = Number(override);
                    }
                }
            }
        }
        catch {
            threshold = DEFAULT_COVERAGE_THRESHOLD;
        }
    }
    let entries;
    try {
        entries = readdirSync(covDir).sort();
    }
    catch {
        return findings;
    }
    for (const name of entries) {
        if (!name.startsWith('F-') || !name.endsWith('.yaml')) {
            continue;
        }
        const fpPath = join(covDir, name);
        let fp;
        try {
            fp = yamlParse(readFileSync(fpPath, 'utf-8'));
        }
        catch {
            continue;
        }
        if (!isPlainObject(fp)) {
            continue;
        }
        const fid = fp['feature_id'] ?? name.replace(/\.yaml$/, '');
        const mismatches = asArray(fp['mismatches']);
        for (const mismatch of mismatches) {
            if (!isPlainObject(mismatch)) {
                continue;
            }
            const metric = typeof mismatch['metric'] === 'string' ? mismatch['metric'] : '';
            const descVal = Number(mismatch['description_value'] ?? 0);
            const acVal = Number(mismatch['ac_value'] ?? 0);
            if (Number.isNaN(descVal) || Number.isNaN(acVal) || descVal <= 0) {
                continue;
            }
            const ratio = acVal / descVal;
            if (ratio < threshold) {
                findings.push({
                    kind: 'Coverage',
                    path: `${fid}::quant.${metric}`,
                    message: `description claims ${descVal} ${metric} but AC accepts ${acVal} ` +
                        `(ratio=${ratio.toFixed(2)}, threshold=${threshold.toFixed(2)}) — explicit ` +
                        'carry-forward required (retro entry or --hotfix-reason)',
                    severity: 'error',
                });
            }
        }
    }
    return findings;
}
// --------------------------------------------------------------------
// Orchestrators
// --------------------------------------------------------------------
/** Full 13-detector run. */
export function runCheck(harnessDir, projectRoot = null) {
    const report = { findings: [], checked: [] };
    const harnessYaml = loadYamlFile(join(harnessDir, 'harness.yaml'));
    const specYaml = loadYamlFile(join(harnessDir, 'spec.yaml'));
    report.findings.push(...checkGenerated(harnessDir, harnessYaml));
    report.checked.push('Generated');
    if (harnessYaml !== null) {
        report.findings.push(...checkDerived(harnessDir, harnessYaml));
        report.checked.push('Derived');
        report.findings.push(...checkSpec(harnessDir, harnessYaml));
        report.checked.push('Spec');
        report.findings.push(...checkIncludes(harnessDir, harnessYaml));
        report.checked.push('Include');
    }
    report.findings.push(...checkEvidence(harnessDir));
    report.checked.push('Evidence');
    if (specYaml !== null) {
        report.findings.push(...checkCode(harnessDir, specYaml, projectRoot));
        report.checked.push('Code');
        report.findings.push(...checkAnchor(specYaml));
        report.checked.push('Anchor');
        report.findings.push(...checkAdrSupersedes(specYaml));
        report.checked.push('Adr');
        report.findings.push(...checkStale(harnessDir, specYaml, projectRoot));
        report.checked.push('Stale');
        report.findings.push(...checkAnchorIntegration(harnessDir, specYaml, projectRoot));
        report.checked.push('AnchorIntegration');
    }
    report.findings.push(...checkDoc(harnessDir, projectRoot));
    report.checked.push('Doc');
    report.findings.push(...checkProtocol(harnessDir));
    report.checked.push('Protocol');
    report.findings.push(...checkSpecCoverage(harnessDir, specYaml));
    report.checked.push('Coverage');
    return report;
}
/**
 * Drift fast path used by complete()'s F-048 wire-integrity gate —
 * inspects only Code · Stale · AnchorIntegration · Coverage.
 */
export function runBlockingCheck(harnessDir, projectRoot = null) {
    const report = { findings: [], checked: [] };
    const specYaml = loadYamlFile(join(harnessDir, 'spec.yaml'));
    if (specYaml !== null) {
        report.findings.push(...checkCode(harnessDir, specYaml, projectRoot));
        report.findings.push(...checkStale(harnessDir, specYaml, projectRoot));
        report.findings.push(...checkAnchorIntegration(harnessDir, specYaml, projectRoot));
    }
    report.findings.push(...checkSpecCoverage(harnessDir, specYaml));
    report.checked.push('Code', 'Stale', 'AnchorIntegration', 'Coverage');
    return report;
}
/** Renders a CheckReport for the `/harness:check` CLI. */
export function formatHuman(report) {
    const lines = ['🔍 /harness:check', ''];
    lines.push(`Checked: ${report.checked.join(', ')}`);
    lines.push('');
    if (report.findings.length === 0) {
        lines.push('✅ clean — drift 없음');
        return `${lines.join('\n')}\n`;
    }
    lines.push(`Findings (${report.findings.length}):`);
    for (const f of report.findings) {
        const marker = f.severity === 'error' ? '❌' : '⚠️ ';
        lines.push(`  ${marker} [${f.kind}] ${f.path}: ${f.message}`);
    }
    // Silence unused-binding linters for the dirname import which the
    // implementation reaches for transitively via resolvePath.
    void dirname;
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=check.js.map