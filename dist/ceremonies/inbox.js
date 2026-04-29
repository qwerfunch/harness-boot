/**
 * Q&A file-drop inbox scanner (F-097 port of
 * `scripts/ceremonies/inbox.py`).
 *
 * Scans `.harness/_workspace/questions/` for files matching
 * `F-N--<from>--<to>.md` and returns those with no `## Answer`
 * section — the "open" inbox an orchestrator polls at stage
 * boundaries.
 *
 * @module ceremonies/inbox
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as yamlParse } from 'yaml';
const FILENAME_RE = /^(F-\d+)--([\w-]+)--([\w-]+)\.md$/;
const ANSWER_HEADER_RE = /^##\s+Answer\b/m;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parseFrontmatter(text) {
    const match = FRONTMATTER_RE.exec(text);
    if (match === null) {
        return {};
    }
    try {
        const parsed = yamlParse(match[1]);
        return isPlainObject(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
/** Returns every matching question file under the harness inbox. */
export function scanInbox(harnessDir, featureId = null) {
    const qDir = join(harnessDir, '_workspace', 'questions');
    let entries;
    try {
        if (!statSync(qDir).isDirectory()) {
            return [];
        }
        entries = readdirSync(qDir).sort();
    }
    catch {
        return [];
    }
    const out = [];
    for (const name of entries) {
        const fullPath = join(qDir, name);
        try {
            if (!statSync(fullPath).isFile()) {
                continue;
            }
        }
        catch {
            continue;
        }
        const m = FILENAME_RE.exec(name);
        if (m === null) {
            continue;
        }
        const [, fid, fromAgent, toAgent] = m;
        if (featureId !== null && fid !== featureId) {
            continue;
        }
        const body = readFileSync(fullPath, 'utf-8');
        const fm = parseFrontmatter(body);
        const hasAnswer = ANSWER_HEADER_RE.test(body);
        out.push({
            feature_id: fid,
            from_agent: fromAgent,
            to_agent: toAgent,
            path: relative(harnessDir, fullPath),
            blocking: Boolean(fm['blocking']),
            has_answer: hasAnswer,
        });
    }
    return out;
}
/** Returns only questions that have not yet been answered. */
export function openQuestions(harnessDir, featureId = null) {
    return scanInbox(harnessDir, featureId).filter((q) => !q.has_answer);
}
//# sourceMappingURL=inbox.js.map