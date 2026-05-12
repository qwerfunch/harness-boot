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

import {readFileSync} from 'node:fs';
import {basename, relative, resolve as resolvePath} from 'node:path';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

import {redactSecrets} from './codebase/redact.js';
import {computeContentHash} from './draftLabel.js';

/** Result of {@link seedSpecFromPlanDoc}. */
export interface SeedPlanDocResult {
  /** The rewritten spec.yaml body. */
  readonly specYaml: string;
  /** Project name derived from the H1 or filename. */
  readonly projectName: string;
  /** First paragraph of the plan doc (already redacted). */
  readonly summary: string;
  /** Path stamped into `metadata.source.plan_doc_path` (relative when possible). */
  readonly planDocPath: string;
  /** SHA-256 content hash matching the rewritten body. */
  readonly contentHash: string;
}

/** Required input for {@link seedSpecFromPlanDoc}. */
export interface SeedPlanDocInput {
  /** Path to the markdown plan document. */
  readonly mdPath: string;
  /** Path to the existing spec.yaml (rewritten in place). */
  readonly specPath: string;
  /** Project root used to compute the relative plan_doc_path. */
  readonly projectRoot: string;
}

function deriveProjectName(mdBody: string, mdPath: string): string {
  const h1Match = mdBody.match(/^#\s+(.+?)\s*$/m);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim();
  }
  const file = basename(mdPath);
  return file.replace(/\.md$/i, '').replace(/[_\-.]/g, ' ').trim() || 'project';
}

function deriveSummary(mdBody: string): string {
  // Strip the first H1 + blank lines, then take the first non-empty,
  // non-heading paragraph.
  const withoutFirstH1 = mdBody.replace(/^#\s+.+?\n+/, '');
  const paragraphs = withoutFirstH1.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#')) continue;
    // Collapse internal whitespace + cap at ~200 chars for spec.summary.
    return trimmed.replace(/\s+/g, ' ').slice(0, 200);
  }
  return '';
}

function deriveDescription(mdBody: string): string {
  return mdBody.slice(0, 500);
}

/**
 * Read the plan doc, redact, and rewrite spec.yaml with the seeded
 * metadata + project fields. Returns enough detail for the CLI to
 * report what happened.
 */
export function seedSpecFromPlanDoc(input: SeedPlanDocInput): SeedPlanDocResult {
  const raw = readFileSync(input.mdPath, 'utf8');
  const {text: mdBody} = redactSecrets(raw);
  const projectName = deriveProjectName(mdBody, input.mdPath);
  const summary = redactSecrets(deriveSummary(mdBody)).text;
  const description = redactSecrets(deriveDescription(mdBody)).text;

  const specBody = readFileSync(input.specPath, 'utf8');
  const parsed = (yamlParse(specBody) ?? {}) as Record<string, unknown>;
  const project = (parsed['project'] as Record<string, unknown> | undefined) ?? {};
  project['name'] = projectName;
  project['summary'] = summary;
  project['description'] = description;
  parsed['project'] = project;

  const planDocPath = relative(resolvePath(input.projectRoot), resolvePath(input.mdPath));
  const metadata = (parsed['metadata'] as Record<string, unknown> | undefined) ?? {};
  const source = (metadata['source'] as Record<string, unknown> | undefined) ?? {};
  source['origin'] = 'plan_doc';
  source['plan_doc_path'] = planDocPath;
  metadata['source'] = source;
  metadata['draft'] = true;
  // Drop any stale hash before we recompute.
  delete metadata['content_hash'];
  parsed['metadata'] = metadata;

  const intermediate = yamlStringify(parsed, {sortMapEntries: true});
  const contentHash = computeContentHash(intermediate);
  metadata['content_hash'] = contentHash;
  parsed['metadata'] = metadata;
  const finalYaml = yamlStringify(parsed, {sortMapEntries: true});

  return {
    specYaml: finalYaml,
    projectName,
    summary,
    planDocPath,
    contentHash,
  };
}
