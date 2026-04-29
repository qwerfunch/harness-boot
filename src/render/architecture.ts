/**
 * Renders `spec.yaml` to `.harness/architecture.yaml` (F-091 port of
 * `scripts/render/architecture.py`, F-003 §0.5).
 *
 * Output structure:
 *
 *     version: "2.3"
 *     generated_at: <timestamp>
 *     from_spec: <path>
 *     tech_stack: { ...spec.constraints.tech_stack }
 *     deliverable: { ...spec.deliverable }
 *     modules:
 *       - name: <module_name>
 *         owners: [<feature_id>, ...]
 *     contribution_points: [...metadata.contribution_points]
 *     host_binding: {...metadata.host_binding}
 *     feature_graph:
 *       - id: <feature_id>
 *         modules: [...]
 *         depends_on: [...]
 *
 * Parity contract: this port targets **semantic-equivalence parity**
 * (round-trip parse yields identical data) rather than byte-equal
 * YAML. PyYAML and eemeli/yaml differ on quoting; the TS port
 * becomes canonical post-migration so cohabitation is short-lived.
 *
 * @module render/architecture
 */

import {readFileSync} from 'node:fs';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

/** Optional input for {@link render}. */
export interface RenderArchitectureOptions {
  /** Override generation timestamp for deterministic parity tests. */
  timestamp?: string;
  /** Source-file label recorded in `from_spec`. */
  sourceRef?: string;
}

interface ModuleEntry {
  name: string;
  owners: string[];
}

interface FeatureGraphEntry {
  id: string;
  name?: string;
  modules?: string[];
  depends_on?: unknown[];
  status?: string;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nowIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

/**
 * Reverses `features[*].modules` to `module → owning features`.
 *
 * Module values inside a feature can be either strings or
 * `{name: ...}` objects. Output is sorted ascending by module name.
 */
function buildModulesMap(features: unknown[]): ModuleEntry[] {
  const owners = new Map<string, string[]>();
  for (const f of features) {
    const obj = asObject(f);
    if (obj === null) {
      continue;
    }
    const fid = asString(obj['id'], 'F-?');
    const mods = asArray(obj['modules']);
    for (const m of mods) {
      let name: string | null = null;
      if (typeof m === 'string') {
        name = m;
      } else {
        const mObj = asObject(m);
        if (mObj !== null && typeof mObj['name'] === 'string') {
          name = mObj['name'];
        }
      }
      if (name === null) {
        continue;
      }
      if (!owners.has(name)) {
        owners.set(name, []);
      }
      owners.get(name)!.push(fid);
    }
  }
  const sorted = [...owners.keys()].sort();
  return sorted.map((name) => ({name, owners: owners.get(name)!}));
}

/**
 * Builds a slimmed feature view for the architecture graph — id +
 * optional name/modules/depends_on/status.
 */
function buildFeatureGraph(features: unknown[]): FeatureGraphEntry[] {
  const out: FeatureGraphEntry[] = [];
  for (const f of features) {
    const obj = asObject(f);
    if (obj === null) {
      continue;
    }
    const entry: FeatureGraphEntry = {id: asString(obj['id'], 'F-?')};
    if (typeof obj['name'] === 'string') {
      entry.name = obj['name'];
    }
    const mods = asArray(obj['modules']);
    const modNames: string[] = [];
    for (const m of mods) {
      if (typeof m === 'string') {
        modNames.push(m);
      } else {
        const mObj = asObject(m);
        if (mObj !== null && typeof mObj['name'] === 'string') {
          modNames.push(mObj['name']);
        }
      }
    }
    if (modNames.length > 0) {
      entry.modules = modNames;
    }
    const deps = asArray(obj['depends_on']);
    if (deps.length > 0) {
      entry.depends_on = [...deps];
    }
    const status = asString(obj['status']);
    if (status) {
      entry.status = status;
    }
    out.push(entry);
  }
  return out;
}

/**
 * Renders the parsed spec into an `architecture.yaml` document.
 *
 * @param spec - Parsed `spec.yaml` object.
 * @param options - Optional timestamp / from_spec override.
 * @returns The complete architecture.yaml text.
 */
export function render(
  spec: Record<string, unknown>,
  options: RenderArchitectureOptions = {},
): string {
  const timestamp = options.timestamp ?? nowIso();
  const sourceRef = options.sourceRef ?? 'spec.yaml';

  const out: Record<string, unknown> = {};
  out['version'] = asString(spec['version'], '2.3');
  out['generated_at'] = timestamp;
  out['from_spec'] = sourceRef;

  const constraints = asObject(spec['constraints']);
  const techStack = constraints !== null ? asObject(constraints['tech_stack']) : null;
  if (techStack !== null && Object.keys(techStack).length > 0) {
    out['tech_stack'] = techStack;
  }

  const deliverable = asObject(spec['deliverable']);
  if (deliverable !== null && Object.keys(deliverable).length > 0) {
    out['deliverable'] = deliverable;
  }

  const features = asArray(spec['features']);
  const modules = buildModulesMap(features);
  if (modules.length > 0) {
    out['modules'] = modules;
  }

  const metadata = asObject(spec['metadata']);
  if (metadata !== null) {
    for (const key of [
      'contribution_points',
      'host_binding',
      'command_map',
      'ambient_files',
    ]) {
      const val = metadata[key];
      if (
        val !== null &&
        val !== undefined &&
        !(Array.isArray(val) && val.length === 0)
      ) {
        out[key] = val;
      }
    }
  }

  const graph = buildFeatureGraph(features);
  if (graph.length > 0) {
    out['feature_graph'] = graph;
  }

  return yamlStringify(out, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0,
  });
}

/** Reads + parses a YAML spec file, mirroring Python's `load_spec`. */
export function loadSpec(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf-8');
  const parsed: unknown = yamlParse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path}: top-level YAML must be a mapping`);
  }
  return parsed as Record<string, unknown>;
}
