/**
 * Renders `spec.yaml` to `.harness/domain.md` (F-091 port of
 * `scripts/render/domain.py`, F-003 §0.4).
 *
 * The output is **byte-equal** with the Python implementation for
 * identical inputs — `/harness:check`'s Derived drift detector
 * depends on this property, and the migration would silently break
 * that detector if the rendered text drifted.
 *
 * Section order (do not reorder without bumping the spec version):
 *
 *   1. Header + generation timestamp
 *   2. `## Project` — summary · description · vision
 *   3. `## Platform` — `constraints.tech_stack` (v0.7.4 additive)
 *   4. `## Stakeholders`
 *   5. `## Entities`
 *   6. `## Business Rules`
 *   7. `## Decisions` — decisions[] ADR catalog (v0.6 additive)
 *   8. `## Risks` — risks[] catalog (v0.6 additive)
 *
 * Input contract: the spec passed in must already have `$include`
 * expansion applied — see {@link import('../spec/includeExpander.ts').expand}.
 *
 * @module render/domain
 */
import { readFileSync } from 'node:fs';
import { parse as yamlParse } from 'yaml';
/** Type-safe access to a possibly-nested dict via dotted path. */
function getPath(d, path, defaultValue = null) {
    let cur = d;
    for (const part of path.split('.')) {
        if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
            return defaultValue;
        }
        cur = cur[part];
        if (cur === null || cur === undefined) {
            return defaultValue;
        }
    }
    return cur;
}
/**
 * Mirrors Python's `_multiline` helper — preserves embedded line
 * breaks and trailing newline semantics.
 */
function multiline(text, prefix = '') {
    if (!text) {
        return '';
    }
    const lines = text.split('\n').map((line) => (line ? prefix + line : ''));
    return `${lines.join('\n')}\n`;
}
/** Drops the trailing `\n` produced by {@link multiline}, matching Python's `.rstrip()`. */
function rstrip(text) {
    return text.replace(/\s+$/, '');
}
function nowIso() {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
function asObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}
/**
 * Renders the parsed spec into a `domain.md` document.
 *
 * @param spec - Parsed `spec.yaml` (already $include-expanded).
 * @param options - Optional timestamp override for deterministic
 *   parity tests.
 * @returns The complete domain.md text including a trailing
 *   newline.
 */
export function render(spec, options = {}) {
    const timestamp = options.timestamp ?? nowIso();
    const projectName = asString(getPath(spec, 'project.name', '(unnamed)'), '(unnamed)');
    const projectSummary = asString(getPath(spec, 'project.summary', ''));
    const projectDescription = asString(getPath(spec, 'project.description', ''));
    const projectVision = asString(getPath(spec, 'project.vision', ''));
    const stakeholders = asArray(getPath(spec, 'project.stakeholders', []));
    const entities = asArray(getPath(spec, 'domain.entities', []));
    const businessRules = asArray(getPath(spec, 'domain.business_rules', []));
    const decisions = asArray(getPath(spec, 'decisions', []));
    const risks = asArray(getPath(spec, 'risks', []));
    const techStack = asObject(getPath(spec, 'constraints.tech_stack', {})) ?? {};
    const lines = [];
    // Header
    lines.push(`# ${projectName} — Domain View`);
    lines.push('');
    lines.push(`> 자동 생성 — ${timestamp}`);
    lines.push('>');
    lines.push('> 이 파일은 `/harness:sync` 가 `spec.yaml` 에서 파생. 직접 편집 시 edit-wins 보호.');
    lines.push('');
    // Project
    lines.push('## Project');
    lines.push('');
    if (projectSummary) {
        lines.push(`**Summary**: ${projectSummary}`);
        lines.push('');
    }
    if (projectDescription) {
        lines.push('**Description**:');
        lines.push('');
        lines.push(rstrip(multiline(projectDescription)));
        lines.push('');
    }
    if (projectVision) {
        lines.push('**Vision**:');
        lines.push('');
        lines.push(rstrip(multiline(projectVision)));
        lines.push('');
    }
    // Platform — v0.7.4 additive. Tier-1 design agents lack architecture.yaml access.
    if (Object.keys(techStack).length > 0) {
        lines.push('## Platform');
        lines.push('');
        const runtime = asString(techStack['runtime']);
        const minVersion = asString(techStack['min_version']);
        if (runtime) {
            let runtimeLine = `**Runtime**: ${runtime}`;
            if (minVersion) {
                runtimeLine += ` ${minVersion}+`;
            }
            lines.push(runtimeLine);
            lines.push('');
        }
        const language = asString(techStack['language']);
        if (language) {
            lines.push(`**Language**: ${language}`);
            lines.push('');
        }
        const test = asString(techStack['test']);
        if (test) {
            lines.push(`**Test**: ${test}`);
            lines.push('');
        }
        const build = asString(techStack['build']);
        if (build) {
            lines.push(`**Build**: ${build}`);
            lines.push('');
        }
        const known = new Set(['runtime', 'min_version', 'language', 'test', 'build']);
        const extras = Object.entries(techStack).filter(([k]) => !known.has(k));
        if (extras.length > 0) {
            lines.push('**Extra**:');
            for (const [k, v] of extras) {
                lines.push(`- ${k}: ${stringifyValue(v)}`);
            }
            lines.push('');
        }
    }
    // Stakeholders
    lines.push(`## Stakeholders (${stakeholders.length})`);
    lines.push('');
    if (stakeholders.length === 0) {
        lines.push('_(정의된 stakeholder 없음 — `spec.yaml` 의 `project.stakeholders[]` 채우기.)_');
        lines.push('');
    }
    else {
        for (const sh of stakeholders) {
            const obj = asObject(sh);
            if (obj === null) {
                continue;
            }
            const role = asString(obj['role']) || asString(obj['id']) || '(unnamed)';
            const count = obj['count'];
            let heading = `### ${role}`;
            if (count !== undefined && count !== null && count !== '') {
                heading += ` (${stringifyValue(count)})`;
            }
            lines.push(heading);
            lines.push('');
            const desc = asString(obj['description']) || asString(obj['interest']);
            if (desc) {
                lines.push(rstrip(multiline(desc)));
                lines.push('');
            }
            for (const [listKey, label] of [
                ['concerns', 'Concerns'],
                ['wants', 'Wants'],
                ['needs', 'Needs'],
            ]) {
                const items = obj[listKey];
                if (Array.isArray(items) && items.length > 0) {
                    lines.push(`**${label}**:`);
                    for (const item of items) {
                        const itemObj = asObject(item);
                        if (itemObj !== null) {
                            const text = asString(itemObj['text']) ||
                                asString(itemObj['statement']) ||
                                String(item);
                            lines.push(`- ${text}`);
                        }
                        else {
                            lines.push(`- ${stringifyValue(item)}`);
                        }
                    }
                    lines.push('');
                }
            }
        }
    }
    // Entities
    lines.push(`## Entities (${entities.length})`);
    lines.push('');
    if (entities.length === 0) {
        lines.push('_(정의된 엔티티 없음 — `spec.yaml` 의 `domain.entities[]` 채우기.)_');
        lines.push('');
    }
    else {
        for (const ent of entities) {
            const obj = asObject(ent);
            if (obj === null) {
                continue;
            }
            const entName = asString(obj['name']) || asString(obj['id']) || '(unnamed)';
            const entDesc = asString(obj['description']) || asString(obj['summary']);
            const invariants = asArray(obj['invariants']);
            const attrs = Array.isArray(obj['attributes'])
                ? obj['attributes']
                : asArray(obj['fields']);
            lines.push(`### ${entName}`);
            lines.push('');
            if (entDesc) {
                lines.push(rstrip(multiline(entDesc)));
                lines.push('');
            }
            if (attrs.length > 0) {
                lines.push('**Attributes**:');
                for (const a of attrs) {
                    const attrObj = asObject(a);
                    if (attrObj !== null) {
                        const aName = asString(attrObj['name'], '?');
                        const aType = asString(attrObj['type'], '?');
                        lines.push(`- \`${aName}\`: ${aType}`);
                    }
                    else {
                        lines.push(`- \`${stringifyValue(a)}\``);
                    }
                }
                lines.push('');
            }
            if (invariants.length > 0) {
                lines.push('**Invariants**:');
                for (const inv of invariants) {
                    const invObj = asObject(inv);
                    if (invObj !== null) {
                        lines.push(`- ${asString(invObj['statement'], stringifyValue(inv))}`);
                    }
                    else {
                        lines.push(`- ${stringifyValue(inv)}`);
                    }
                }
                lines.push('');
            }
        }
    }
    // Business Rules
    lines.push(`## Business Rules (${businessRules.length})`);
    lines.push('');
    if (businessRules.length === 0) {
        lines.push('_(정의된 BR 없음 — `spec.yaml` 의 `domain.business_rules[]` 채우기.)_');
        lines.push('');
    }
    else {
        businessRules.forEach((br, idx) => {
            const i = idx + 1;
            const padded = `BR-${String(i).padStart(3, '0')}`;
            const obj = asObject(br);
            if (obj !== null) {
                const brId = asString(obj['id'], padded);
                const statement = asString(obj['statement']) || asString(obj['name']);
                const rationale = asString(obj['rationale']);
                lines.push(`### ${brId}`);
                lines.push('');
                if (statement) {
                    lines.push(`**Statement**: ${statement}`);
                    lines.push('');
                }
                if (rationale) {
                    lines.push(`**Rationale**: ${rationale}`);
                    lines.push('');
                }
            }
            else {
                lines.push(`- ${padded}: ${stringifyValue(br)}`);
                lines.push('');
            }
        });
    }
    // Decisions — v0.6 additive
    lines.push(`## Decisions (${decisions.length})`);
    lines.push('');
    if (decisions.length === 0) {
        lines.push('_(정의된 ADR 없음 — `spec.yaml` 의 `decisions[]` 또는 plan.md 를 경유해 채우기.)_');
        lines.push('');
    }
    else {
        for (const d of decisions) {
            const obj = asObject(d);
            if (obj === null) {
                continue;
            }
            const adrId = asString(obj['id'], 'ADR-???');
            const title = asString(obj['title'], '(untitled)');
            const status = asString(obj['status'], 'accepted');
            const tags = asArray(obj['tags']);
            const tagStr = tags.length > 0 ? ` · tags: ${tags.map(String).join(', ')}` : '';
            lines.push(`### ${adrId} — ${title}`);
            lines.push('');
            lines.push(`**Status**: ${status}${tagStr}`);
            lines.push('');
            const context = asString(obj['context']);
            const decision = asString(obj['decision']);
            const consequences = asString(obj['consequences']);
            if (context) {
                lines.push('**Context**:');
                lines.push('');
                lines.push(rstrip(multiline(context)));
                lines.push('');
            }
            if (decision) {
                lines.push('**Decision**:');
                lines.push('');
                lines.push(rstrip(multiline(decision)));
                lines.push('');
            }
            if (consequences) {
                lines.push('**Consequences**:');
                lines.push('');
                lines.push(rstrip(multiline(consequences)));
                lines.push('');
            }
            const supersedes = asArray(obj['supersedes']);
            const supersededBy = asString(obj['superseded_by']);
            if (supersedes.length > 0) {
                lines.push(`**Supersedes**: ${supersedes.map(String).join(', ')}`);
                lines.push('');
            }
            if (supersededBy) {
                lines.push(`**Superseded by**: ${supersededBy}`);
                lines.push('');
            }
        }
    }
    // Risks — v0.6 additive
    lines.push(`## Risks (${risks.length})`);
    lines.push('');
    if (risks.length === 0) {
        lines.push('_(정의된 risk 없음 — `spec.yaml` 의 `risks[]` 또는 plan.md 를 경유해 채우기.)_');
        lines.push('');
    }
    else {
        for (const r of risks) {
            const obj = asObject(r);
            if (obj === null) {
                continue;
            }
            const riskId = asString(obj['id'], 'R-???');
            const statement = asString(obj['statement']);
            const likelihood = asString(obj['likelihood'], '?');
            const impact = asString(obj['impact'], '?');
            const mitigation = asString(obj['mitigation']);
            const status = asString(obj['status'], 'open');
            const tags = asArray(obj['tags']);
            const tagStr = tags.length > 0 ? ` · tags: ${tags.map(String).join(', ')}` : '';
            lines.push(`### ${riskId}`);
            lines.push('');
            if (statement) {
                lines.push(`**Statement**: ${statement}`);
                lines.push('');
            }
            lines.push(`**Likelihood × Impact**: ${likelihood} × ${impact} · status: ${status}${tagStr}`);
            lines.push('');
            if (mitigation) {
                lines.push(`**Mitigation**: ${mitigation}`);
                lines.push('');
            }
        }
    }
    return `${rstrip(lines.join('\n'))}\n`;
}
/** Renders any scalar to a Python-shaped string for `str(value)` parity. */
function stringifyValue(value) {
    if (value === null) {
        return 'None';
    }
    if (value === undefined) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
    return String(value);
}
/** Reads + parses a YAML spec file, mirroring Python's `load_spec`. */
export function loadSpec(path) {
    const raw = readFileSync(path, 'utf-8');
    const parsed = yamlParse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${path}: top-level YAML must be a mapping`);
    }
    return parsed;
}
//# sourceMappingURL=domain.js.map