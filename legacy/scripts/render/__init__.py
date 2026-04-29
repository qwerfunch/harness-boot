"""Renderers that derive human-readable artifacts from spec.yaml.

Each module ships a pure `render(spec_dict, *, timestamp=None) -> str` function
plus a `load_spec(path)` helper. The `scripts/sync.py` CLI composes these and
writes outputs under `.harness/`.

Internal — consumers are `scripts.sync` and tests; not called from commands/*.md.
"""
