"""Shared low-level helpers used by every public CLI entry point.

Modules:

- ``state``          — ``.harness/state.yaml`` load/save/mutation helpers.
- ``canonical_hash`` — YAML → canonical JSON → SHA-256 Merkle tree (F-010).
- ``plugin_root``    — 4-strategy PLUGIN_ROOT resolution (F-011).

Anything in this package must be side-effect-free on import and must not
depend on any sibling subpackage. Consumers: every ``scripts/*.py`` root
CLI entry + the subpackages under ``scripts/`` (``gate``, ``ceremonies``,
``spec``, ``render``). The dependency arrow only points **into** ``core``,
never out of it.
"""
