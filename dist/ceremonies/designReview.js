/**
 * Design Review ceremony template generator (F-097 port of
 * `scripts/ceremonies/design_review.py`).
 *
 * When ux-architect saves `flows.md`, the orchestrator fires this to
 * scaffold `.harness/_workspace/design-review/F-N.md` — a template
 * with per-reviewer subheadings (visual-designer + frontend-engineer
 * + a11y-auditor, plus audio-designer when has_audio=true).
 *
 * @module ceremonies/designReview
 */
import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
const CORE_REVIEWERS = [
    'visual-designer',
    'frontend-engineer',
    'a11y-auditor',
];
const AUDIO_REVIEWER = 'audio-designer';
/**
 * Returns the reviewer ordering for a feature. When `hasAudio` is
 * true, audio-designer slots in immediately before a11y-auditor
 * (parallels kickoff ordering).
 */
export function reviewersFor(hasAudio) {
    const out = [...CORE_REVIEWERS];
    if (hasAudio) {
        const idx = out.indexOf('a11y-auditor');
        if (idx === -1) {
            out.push(AUDIO_REVIEWER);
        }
        else {
            out.splice(idx, 0, AUDIO_REVIEWER);
        }
    }
    return out;
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
function rstrip(s) {
    return s.replace(/\s+$/, '');
}
function pythonStyleJsonStringify(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => pythonStyleJsonStringify(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const pairs = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`);
        return `{${pairs.join(', ')}}`;
    }
    throw new TypeError(`designReview: unsupported value type ${typeof value}.`);
}
function appendEvent(harnessDir, event) {
    const logPath = join(harnessDir, 'events.log');
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}
function template(featureId, reviewers, timestamp) {
    const lines = [];
    lines.push(`# Design Review — ${featureId}`);
    lines.push('');
    lines.push(`> 자동 생성 — ${timestamp}`);
    lines.push('>');
    lines.push('> `scripts/design_review.py` 가 이 템플릿을 만들고, orchestrator 가 reviewer ' +
        '별로 `flows.md` 에 대한 concern 을 한 문단씩 수집 → 마지막 Decisions 섹션은 ' +
        'orchestrator 가 disposition 후 작성.');
    lines.push('');
    lines.push(`## Reviewers (${reviewers.length})`);
    lines.push('');
    for (const r of reviewers) {
        lines.push(`- \`@harness:${r}\``);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    for (const r of reviewers) {
        lines.push(`## ${r} concerns`);
        lines.push('');
        lines.push('<!-- orchestrator: 이 reviewer 의 Tier anchor 기반 한 문단 concern -->');
        lines.push('');
        lines.push('_(pending)_');
        lines.push('');
    }
    lines.push('## Decisions');
    lines.push('');
    lines.push('<!-- orchestrator: reviewer concern 을 종합해 수용/연기/기각 판단. 2회 반복 충돌 시 사용자 escalate. -->');
    lines.push('');
    lines.push('_(pending)_');
    lines.push('');
    return `${rstrip(lines.join('\n'))}\n`;
}
/**
 * Generates `.harness/_workspace/design-review/F-N.md` plus a
 * `design_review_opened` event. Returns the template path.
 */
export function generateDesignReview(harnessDir, featureId, options = {}) {
    const hasAudio = options.hasAudio ?? false;
    const timestamp = options.timestamp ?? nowIso();
    const reviewers = reviewersFor(hasAudio);
    const reviewDir = join(harnessDir, '_workspace', 'design-review');
    mkdirSync(reviewDir, { recursive: true });
    const path = join(reviewDir, `${featureId}.md`);
    writeFileSync(path, template(featureId, reviewers, timestamp), 'utf-8');
    appendEvent(harnessDir, {
        ts: timestamp,
        type: 'design_review_opened',
        feature: featureId,
        reviewers,
        has_audio: hasAudio,
        path: relative(harnessDir, path),
    });
    return path;
}
function _isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
/** True iff the design-review template for `featureId` already exists. */
export function designReviewExists(harnessDir, featureId) {
    return _isFile(join(harnessDir, '_workspace', 'design-review', `${featureId}.md`));
}
//# sourceMappingURL=designReview.js.map