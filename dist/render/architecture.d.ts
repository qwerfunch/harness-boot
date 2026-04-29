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
/** Optional input for {@link render}. */
export interface RenderArchitectureOptions {
    /** Override generation timestamp for deterministic parity tests. */
    timestamp?: string;
    /** Source-file label recorded in `from_spec`. */
    sourceRef?: string;
}
/**
 * Renders the parsed spec into an `architecture.yaml` document.
 *
 * @param spec - Parsed `spec.yaml` object.
 * @param options - Optional timestamp / from_spec override.
 * @returns The complete architecture.yaml text.
 */
export declare function render(spec: Record<string, unknown>, options?: RenderArchitectureOptions): string;
/** Reads + parses a YAML spec file, mirroring Python's `load_spec`. */
export declare function loadSpec(path: string): Record<string, unknown>;
//# sourceMappingURL=architecture.d.ts.map