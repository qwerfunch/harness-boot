#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Agent Body Byte-Equality Verifier                          │
 * │                                                             │
 * │  For each Tier-1 agent in the target harness under          │
 * │  .claude/agents/, assert the body region in the generated   │
 * │  file matches the corresponding template in                 │
 * │  docs/templates/agents/bodies/<slug>.md.tmpl byte-for-byte. │
 * │                                                             │
 * │  The body region is the content BETWEEN                     │
 * │  `<!-- AGENT_BODY_START -->` and `<!-- AGENT_BODY_END -->`  │
 * │  in the template. In the generated agent file, the same     │
 * │  region is located between the first `## Role` heading      │
 * │  (inclusive) and the end of the agent body — specifically,  │
 * │  the region of the generated file from the first `## Role`  │
 * │  line up to (but not including) the first Rule fragment     │
 * │  section. Rule fragments are identified by the `## `        │
 * │  headings listed in the Step 4 matrix of commands/setup.md. │
 * │                                                             │
 * │  Exception: reviewer.md must have its                       │
 * │  `{{DOMAIN_CONTEXT_INLINE}}` placeholder replaced with      │
 * │  project-specific content. The verifier accepts any         │
 * │  non-empty substitution between the                         │
 * │  `<!-- DOMAIN_CONTEXT_START -->` and                        │
 * │  `<!-- DOMAIN_CONTEXT_END -->` markers; every other byte    │
 * │  of the reviewer body must still match.                     │
 * │                                                             │
 * │  Usage:                                                     │
 * │    node scripts/verify-agent-bodies.mjs <agents-dir>        │
 * │                                                             │
 * │  Exit 0 = all Tier-1 agents match (silent). Exit 2 =        │
 * │  mismatch(es) printed to stdout. Exit 1 = usage error or    │
 * │  missing template.                                          │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');
const BODIES_DIR = join(PLUGIN_ROOT, 'docs/templates/agents/bodies');

const TIER1_AGENTS = [
  'orchestrator',
  'architect',
  'reviewer',
  'debugger',
  'tdd-implementer',
  'tdd-refactorer',
  'bdd-writer',
  'tdd-test-writer',
  'tester',
  'intent-verifier',
];

const BODY_START = '<!-- AGENT_BODY_START -->';
const BODY_END = '<!-- AGENT_BODY_END -->';
const DOMAIN_START = '<!-- DOMAIN_CONTEXT_START -->';
const DOMAIN_END = '<!-- DOMAIN_CONTEXT_END -->';

/**
 * Extract the substring between `startMarker` and `endMarker` (markers excluded).
 * Returns null if either marker is missing.
 */
function extractBetween(text, startMarker, endMarker) {
  const s = text.indexOf(startMarker);
  if (s < 0) return null;
  const bodyStart = s + startMarker.length;
  const e = text.indexOf(endMarker, bodyStart);
  if (e < 0) return null;
  return text.slice(bodyStart, e);
}

/**
 * Strip YAML frontmatter (if present) from the head of a markdown string.
 * Returns the remainder after the closing `---` line.
 */
function stripFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return text;
  const after = text.indexOf('\n', end + 4);
  return after < 0 ? '' : text.slice(after + 1);
}

/**
 * Normalize a template body for comparison: strip leading/trailing blank
 * lines that the template wrapping naturally contributes around its
 * `<!-- AGENT_BODY_START/END -->` markers. We only strip *outer* whitespace;
 * internal formatting must still match exactly.
 */
function trimOuterBlank(s) {
  return s.replace(/^\s*\n/, '').replace(/\n\s*$/, '\n');
}

/**
 * For reviewer.md, mask the project-specific DOMAIN_CONTEXT_INLINE substitution
 * back to the placeholder so the comparison proceeds byte-for-byte on the rest.
 * Requires the generated file to contain the `<!-- DOMAIN_CONTEXT_START -->` /
 * `<!-- DOMAIN_CONTEXT_END -->` markers AND non-empty content between them.
 */
function maskReviewerDomainContext(generatedBody) {
  const s = generatedBody.indexOf(DOMAIN_START);
  const e = generatedBody.indexOf(DOMAIN_END);
  if (s < 0 || e < 0 || e <= s) {
    return { ok: false, reason: 'reviewer body missing DOMAIN_CONTEXT markers' };
  }
  const inner = generatedBody.slice(s + DOMAIN_START.length, e).trim();
  if (inner.length === 0) {
    return { ok: false, reason: 'reviewer DOMAIN_CONTEXT_INLINE was not substituted (still empty)' };
  }
  if (inner.includes('{{DOMAIN_CONTEXT_INLINE}}')) {
    return {
      ok: false,
      reason: 'reviewer DOMAIN_CONTEXT_INLINE placeholder was not substituted with project-specific content',
    };
  }
  const masked =
    generatedBody.slice(0, s + DOMAIN_START.length) +
    '\n{{DOMAIN_CONTEXT_INLINE}}\n' +
    generatedBody.slice(e);
  return { ok: true, masked };
}

/**
 * Compare a single agent. Returns an array of violation strings (empty = OK).
 */
function verifyAgent(slug, agentsDir) {
  const violations = [];
  const tmplPath = join(BODIES_DIR, `${slug}.md.tmpl`);
  const agentPath = join(agentsDir, `${slug}.md`);

  if (!existsSync(tmplPath)) {
    violations.push(`${slug}: template missing at ${tmplPath}`);
    return violations;
  }
  if (!existsSync(agentPath)) {
    // tdd-test-writer is conditional — absence is allowed, skip silently.
    if (slug === 'tdd-test-writer') return violations;
    violations.push(`${slug}: generated agent missing at ${agentPath}`);
    return violations;
  }

  const tmplText = readFileSync(tmplPath, 'utf8');
  const agentText = readFileSync(agentPath, 'utf8');

  const tmplBody = extractBetween(tmplText, BODY_START, BODY_END);
  if (tmplBody === null) {
    violations.push(`${slug}: template is missing AGENT_BODY markers`);
    return violations;
  }

  const agentBodyRegion = extractBetween(agentText, BODY_START, BODY_END);
  if (agentBodyRegion === null) {
    violations.push(
      `${slug}: generated agent is missing AGENT_BODY markers — Phase 3 must preserve them during copy`,
    );
    return violations;
  }

  let expected = trimOuterBlank(tmplBody);
  let actual = trimOuterBlank(agentBodyRegion);

  if (slug === 'reviewer') {
    const masked = maskReviewerDomainContext(actual);
    if (!masked.ok) {
      violations.push(`${slug}: ${masked.reason}`);
      return violations;
    }
    actual = trimOuterBlank(masked.masked);
  }

  if (actual !== expected) {
    // Compact diff: show the first differing region (up to 240 chars).
    const diffIdx = firstDiffIndex(expected, actual);
    const ctxStart = Math.max(0, diffIdx - 60);
    const expectedSnippet = expected.slice(ctxStart, diffIdx + 180).replace(/\n/g, '\\n');
    const actualSnippet = actual.slice(ctxStart, diffIdx + 180).replace(/\n/g, '\\n');
    violations.push(
      `${slug}: body mismatch at offset ${diffIdx}\n  expected: …${expectedSnippet}…\n  actual:   …${actualSnippet}…`,
    );
  }
  // Unused helper; keep to make frontmatter-based checks easy to add later.
  void stripFrontmatter;
  return violations;
}

function firstDiffIndex(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return i;
  }
  return n;
}

function main() {
  const agentsDir = process.argv[2];
  if (!agentsDir) {
    console.error('Usage: node scripts/verify-agent-bodies.mjs <agents-dir>');
    process.exit(1);
  }
  if (!existsSync(agentsDir)) {
    console.error(`ERROR: agents directory not found: ${agentsDir}`);
    process.exit(1);
  }
  const all = [];
  for (const slug of TIER1_AGENTS) {
    all.push(...verifyAgent(slug, agentsDir));
  }
  if (all.length > 0) {
    for (const line of all) console.log(line);
    process.exit(2);
  }
  process.exit(0);
}

main();
