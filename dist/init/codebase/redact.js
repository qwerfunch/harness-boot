/**
 * Secret-redaction pass for scenario-3 codebase scans (F-161).
 *
 * Two layers of defense:
 *
 *   1. {@link redactSecrets} — a regex pass that turns api-key-,
 *      token-, password-shaped strings into `[REDACTED: <kind>]`
 *      placeholders. Applied to every text fact that flows into
 *      `conventions.md`, `spec.yaml`, and the analysis report.
 *   2. {@link FORBIDDEN_FILES} — a path list signals.ts must
 *      refuse to read entirely. Even an empty `.env` is denied so
 *      we never accidentally surface its filename to the LLM.
 *
 * Fail-closed: if the regex misses, the consumer should still
 * treat the file with suspicion. The slash-command prompt carries
 * an additional "if you see anything resembling a credential, write
 * <REDACTED> instead" sentence per plan §scenario-3.
 *
 * @module init/codebase/redact
 */
/** Files signals.ts must never read. */
export const FORBIDDEN_FILES = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '.envrc',
    'secrets.yaml',
    'secrets.yml',
    'credentials.json',
];
const PATTERNS = [
    // OpenAI-style keys (sk-… 20+ chars).
    { kind: 'openai-key', re: /\bsk-[A-Za-z0-9_\-]{20,}\b/g },
    // GitHub PATs (ghp_…, ghu_…, gho_…, github_pat_…).
    { kind: 'github-token', re: /\b(?:ghp|ghu|gho|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
    { kind: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
    // AWS access key id (AKIA…).
    { kind: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/g },
    // Generic api-key / secret / password / token / bearer assignments.
    {
        kind: 'credential-assignment',
        re: /\b(api[_-]?key|secret|password|passwd|pwd|token|bearer|authorization|access[_-]?key)\b\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]{16,})['"]?/gi,
    },
    // RFC-3986 URLs with embedded credentials (https://user:pass@host).
    { kind: 'url-credential', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@[^\s]+\b/g },
];
/**
 * Run the regex pass over `text` and return both the redacted body
 * and the list of matches. Idempotent — running it twice yields the
 * same text because `[REDACTED: ...]` doesn't match any pattern.
 */
export function redactSecrets(text) {
    const matches = [];
    let redacted = text;
    for (const pattern of PATTERNS) {
        const localMatches = [];
        // Use matchAll on a fresh string snapshot so the offsets stay correct.
        for (const m of redacted.matchAll(pattern.re)) {
            if (m.index === undefined)
                continue;
            localMatches.push({ kind: pattern.kind, start: m.index, end: m.index + m[0].length });
        }
        if (localMatches.length === 0)
            continue;
        // Replace from the end so earlier offsets stay valid.
        localMatches.sort((a, b) => b.start - a.start);
        for (const hit of localMatches) {
            redacted =
                redacted.slice(0, hit.start) + `[REDACTED: ${hit.kind}]` + redacted.slice(hit.end);
            matches.push(hit);
        }
    }
    // Re-sort matches in input order for stable reporting.
    matches.sort((a, b) => a.start - b.start);
    return { text: redacted, matches };
}
/**
 * Returns true when the given relative path matches a forbidden
 * file. Used by signals.ts to short-circuit reads.
 */
export function isForbiddenFile(relativePath) {
    const base = relativePath.split('/').pop() ?? relativePath;
    return FORBIDDEN_FILES.includes(base);
}
//# sourceMappingURL=redact.js.map