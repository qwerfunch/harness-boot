"""F-036 — seed-spec composer + CLI.

Combines deterministic manifest/structure scans (and optional LLM-supplied
domain entities) into a schema-valid seed dict for ``.harness/spec.yaml``.

CLI:
    python3 -m scripts.scan.seed_spec --root <repo> --preview
    python3 -m scripts.scan.seed_spec --root <repo> --apply
    python3 -m scripts.scan.seed_spec --root <repo> --skip

The ``--skip`` mode copies the starter template byte-for-byte (option-1
parity), so existing greenfield users see no change.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    import tomllib  # Python 3.11+
except ImportError:
    import tomli as tomllib  # Python 3.10 backport
from typing import Optional

import yaml

from scripts.scan.manifest import extract_project_name, extract_tech_stack
from scripts.scan.structure import scan_structure
from scripts.spec.validate import SpecValidationError, validate


REPO_ROOT = Path(__file__).resolve().parents[2]
STARTER_TEMPLATE_PATH = REPO_ROOT / "docs" / "templates" / "starter" / "spec.yaml.template"

DRAFT_MARKER_KEY = "_seed_status"
DRAFT_MARKER_VALUE = "draft"


def compose_seed(
    root: Path,
    *,
    llm_overview: Optional[str] = None,
    llm_entities: Optional[list[dict]] = None,
) -> dict:
    """Build a seed spec dict from deterministic scans + optional LLM input.

    The returned dict satisfies ``docs/schemas/spec.schema.json``.
    """
    root = Path(root)
    name = extract_project_name(root) or root.name
    stack = extract_tech_stack(root)
    structure = scan_structure(root)

    summary = _readme_summary(root, structure["readme_path"]) or _placeholder_summary(name)
    overview = (llm_overview or "").strip() or summary

    entities = [
        {**entry, DRAFT_MARKER_KEY: DRAFT_MARKER_VALUE}
        for entry in (llm_entities or [])
    ]

    deliverable = _infer_deliverable(stack, root)

    spec: dict = {
        "version": "2.3",
        "project": {
            "name": name,
            "summary": summary,
            "vision": "",
            "stakeholders": [],
        },
        "domain": {
            "overview": overview,
            "entities": entities,
            "business_rules": [],
        },
        "constraints": {
            "tech_stack": stack,
        },
        "deliverable": deliverable,
        "features": [
            {
                "id": "F-0",
                "type": "skeleton",
                "title": f"walking skeleton — {name}",
                "priority": "P0",
                "test_strategy": "lean-tdd",
                "acceptance_criteria": [],
                "modules": [],
            }
        ],
        "metadata": {
            "source": {
                "origin": "existing_code",
                "maturity": "implementation",
                "revision": "v0.1-seed",
            },
            "scan": {
                "top_dirs": structure["top_dirs"],
                "adr_dir": structure["adr_dir"],
                "readme_path": structure["readme_path"],
                "entity_candidate_count": len(structure["entity_candidate_files"]),
            },
        },
    }
    return spec


def render_yaml(seed: dict) -> str:
    """Dump ``seed`` as YAML with stable, human-friendly defaults."""
    return yaml.safe_dump(
        seed,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
    )


def apply_seed(target_root: Path, seed: dict) -> Path:
    """Write the seed dict to ``<target_root>/.harness/spec.yaml`` after validating."""
    validate(seed)
    spec_path = Path(target_root) / ".harness" / "spec.yaml"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(render_yaml(seed), encoding="utf-8")
    return spec_path


def apply_skip(target_root: Path) -> Path:
    """Copy the starter template byte-for-byte (option-1 parity)."""
    spec_path = Path(target_root) / ".harness" / "spec.yaml"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(STARTER_TEMPLATE_PATH, spec_path)
    return spec_path


def _readme_summary(root: Path, readme_rel: Optional[str]) -> str:
    if not readme_rel:
        return ""
    text = (root / readme_rel).read_text(encoding="utf-8", errors="replace")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    for para in paragraphs:
        if para.startswith("#"):
            continue
        return " ".join(para.split())
    return ""


def _placeholder_summary(name: str) -> str:
    return f"{name} — seeded from existing repository (please refine)."


def _infer_deliverable(stack: dict, root: Path) -> dict:
    runtime = stack.get("runtime", "")
    if runtime == "rust":
        cargo = root / "Cargo.toml"
        if cargo.is_file():
            try:
                data = tomllib.loads(cargo.read_text(encoding="utf-8"))
            except tomllib.TOMLDecodeError:
                data = {}
            if data.get("bin") or "[[bin]]" in cargo.read_text(encoding="utf-8"):
                return {"type": "cli", "entry_points": [], "smoke_scenarios": []}
        return {"type": "library", "entry_points": [], "smoke_scenarios": []}
    if runtime == "go":
        return {"type": "cli", "entry_points": [], "smoke_scenarios": []}
    if runtime == "python":
        return {"type": "library", "entry_points": [], "smoke_scenarios": []}
    if runtime == "node":
        return {"type": "web-service", "entry_points": [], "smoke_scenarios": []}
    return {"type": "library", "entry_points": [], "smoke_scenarios": []}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scripts.scan.seed_spec",
        description="Seed .harness/spec.yaml from an existing repository (F-036).",
    )
    parser.add_argument("--root", required=True, help="repository root to scan")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preview", action="store_true", help="emit seed YAML to stdout")
    mode.add_argument("--apply", action="store_true", help="write .harness/spec.yaml")
    mode.add_argument("--skip", action="store_true", help="copy starter template (option-1 parity)")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _build_parser().parse_args(argv)
    root = Path(args.root).resolve()

    if args.skip:
        spec_path = apply_skip(root)
        print(f"wrote starter template to {spec_path}", file=sys.stderr)
        return 0

    seed = compose_seed(root)

    if args.preview:
        try:
            validate(seed)
        except SpecValidationError as err:
            print(f"seed failed schema validation: {err.message}", file=sys.stderr)
            return 5
        sys.stdout.write(render_yaml(seed))
        return 0

    if args.apply:
        try:
            spec_path = apply_seed(root, seed)
        except SpecValidationError as err:
            print(f"seed failed schema validation: {err.message}", file=sys.stderr)
            return 5
        print(f"wrote seed spec to {spec_path}", file=sys.stderr)
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
