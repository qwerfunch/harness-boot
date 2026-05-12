/**
 * Scenario-2 (plan_doc → spec) deterministic seeder (F-162).
 *
 * Reads a markdown plan document, redacts any credential-shaped
 * strings, and stamps a partial draft `spec.yaml` body: project
 * name from the first H1 (or filename fallback), summary from the
 * first paragraph, description from the first 500 characters.
 *
 * The slash command's `spec-conversion` skill picks up from here
 * in a follow-up LLM turn to fill `features[]`, `entities`, and
 * the rest of v2.3.8.
 *
 * @module init/scenarioPlanDoc
 */
import { readFileSync } from 'node:fs';
import { basename, relative, resolve as resolvePath } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { redactSecrets } from './codebase/redact.js';
import { computeContentHash } from './draftLabel.js';
function deriveProjectName(mdBody, mdPath) {
    const h1Match = mdBody.match(/^#\s+(.+?)\s*$/m);
    if (h1Match && h1Match[1]) {
        return h1Match[1].trim();
    }
    const file = basename(mdPath);
    return file.replace(/\.md$/i, '').replace(/[_\-.]/g, ' ').trim() || 'project';
}
function deriveSummary(mdBody) {
    // Strip the first H1 + blank lines, then take the first non-empty,
    // non-heading paragraph.
    const withoutFirstH1 = mdBody.replace(/^#\s+.+?\n+/, '');
    const paragraphs = withoutFirstH1.split(/\n\s*\n/);
    for (const p of paragraphs) {
        const trimmed = p.trim();
        if (trimmed.length === 0)
            continue;
        if (trimmed.startsWith('#'))
            continue;
        // Collapse internal whitespace + cap at ~200 chars for spec.summary.
        return trimmed.replace(/\s+/g, ' ').slice(0, 200);
    }
    return '';
}
function deriveDescription(mdBody) {
    return mdBody.slice(0, 500);
}
/**
 * Read the plan doc, redact, and rewrite spec.yaml with the seeded
 * metadata + project fields. Returns enough detail for the CLI to
 * report what happened.
 */
export function seedSpecFromPlanDoc(input) {
    const raw = readFileSync(input.mdPath, 'utf8');
    const { text: mdBody } = redactSecrets(raw);
    const projectName = deriveProjectName(mdBody, input.mdPath);
    const summary = redactSecrets(deriveSummary(mdBody)).text;
    const description = redactSecrets(deriveDescription(mdBody)).text;
    const specBody = readFileSync(input.specPath, 'utf8');
    const parsed = (yamlParse(specBody) ?? {});
    const project = parsed['project'] ?? {};
    project['name'] = projectName;
    project['summary'] = summary;
    project['description'] = description;
    parsed['project'] = project;
    const planDocPath = relative(resolvePath(input.projectRoot), resolvePath(input.mdPath));
    const metadata = parsed['metadata'] ?? {};
    const source = metadata['source'] ?? {};
    source['origin'] = 'plan_doc';
    source['plan_doc_path'] = planDocPath;
    metadata['source'] = source;
    metadata['draft'] = true;
    // Drop any stale hash before we recompute.
    delete metadata['content_hash'];
    parsed['metadata'] = metadata;
    const intermediate = yamlStringify(parsed, { sortMapEntries: true });
    const contentHash = computeContentHash(intermediate);
    metadata['content_hash'] = contentHash;
    parsed['metadata'] = metadata;
    const finalYaml = yamlStringify(parsed, { sortMapEntries: true });
    return {
        specYaml: finalYaml,
        projectName,
        summary,
        planDocPath,
        contentHash,
    };
}
//# sourceMappingURL=scenarioPlanDoc.js.map