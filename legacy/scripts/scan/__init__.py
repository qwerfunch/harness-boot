"""F-036 — brownfield repo reconnaissance (Layer A).

Deterministic + LLM-assisted scanning of an existing repository to seed
`.harness/spec.yaml` when a user runs `/harness-boot:init` option 3.

Modules:
    - manifest: tech_stack + project name extraction from package manifests.
    - structure: top-level directory shape + entity-candidate file detection.
    - seed_spec: composer that builds a schema-valid seed dict and CLI entry.
"""
