"""F-036 — seed_spec composer + CLI tests."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

from scripts.scan.seed_spec import (
    DRAFT_MARKER_KEY,
    STARTER_TEMPLATE_PATH,
    compose_seed,
    render_yaml,
)
from scripts.spec.validate import validate


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = Path(__file__).parent.parent.parent / "fixtures" / "brownfield-repos"


class TestComposeSeed(unittest.TestCase):
    def test_node_react_seed_passes_schema_validate(self) -> None:
        seed = compose_seed(FIXTURES / "node-react")
        validate(seed)

    def test_python_fastapi_seed_passes_schema_validate(self) -> None:
        seed = compose_seed(FIXTURES / "python-fastapi")
        validate(seed)

    def test_rust_cli_seed_passes_schema_validate(self) -> None:
        seed = compose_seed(FIXTURES / "rust-cli")
        validate(seed)

    def test_origin_marker_existing_code(self) -> None:
        seed = compose_seed(FIXTURES / "node-react")
        self.assertEqual(seed["metadata"]["source"]["origin"], "existing_code")
        self.assertEqual(seed["metadata"]["source"]["maturity"], "implementation")

    def test_walking_skeleton_first_feature(self) -> None:
        seed = compose_seed(FIXTURES / "node-react")
        self.assertEqual(seed["features"][0]["id"], "F-0")
        self.assertEqual(seed["features"][0]["type"], "skeleton")

    def test_tech_stack_seeded(self) -> None:
        seed = compose_seed(FIXTURES / "node-react")
        self.assertEqual(seed["constraints"]["tech_stack"]["runtime"], "node")
        self.assertEqual(seed["constraints"]["tech_stack"]["language"], "typescript")

    def test_project_name_seeded(self) -> None:
        seed = compose_seed(FIXTURES / "python-fastapi")
        self.assertEqual(seed["project"]["name"], "sample-api")

    def test_llm_entities_get_draft_marker(self) -> None:
        seed = compose_seed(
            FIXTURES / "python-fastapi",
            llm_entities=[
                {"name": "User", "description": "Account holder."},
                {"name": "Order", "description": "Single purchase."},
            ],
        )
        entities = seed["domain"]["entities"]
        self.assertEqual(len(entities), 2)
        for entry in entities:
            self.assertEqual(entry[DRAFT_MARKER_KEY], "draft")

    def test_empty_repo_seed_still_valid(self) -> None:
        seed = compose_seed(FIXTURES / "empty-repo")
        validate(seed)
        self.assertEqual(seed["metadata"]["source"]["origin"], "existing_code")


class TestSkipParity(unittest.TestCase):
    """Skip path must produce a spec.yaml byte-equal to the starter template
    (option-1 parity guard)."""

    def test_starter_template_exists(self) -> None:
        self.assertTrue(STARTER_TEMPLATE_PATH.is_file())

    def test_skip_apply_matches_template_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / ".harness" / "spec.yaml"
            target.parent.mkdir()
            shutil.copy(STARTER_TEMPLATE_PATH, target)
            self.assertEqual(target.read_bytes(), STARTER_TEMPLATE_PATH.read_bytes())


class TestRenderYaml(unittest.TestCase):
    def test_yaml_roundtrip_preserves_required_fields(self) -> None:
        seed = compose_seed(FIXTURES / "node-react")
        text = render_yaml(seed)
        loaded = yaml.safe_load(text)
        self.assertEqual(loaded["project"]["name"], "sample-todo-app")
        self.assertEqual(loaded["metadata"]["source"]["origin"], "existing_code")


class TestCLI(unittest.TestCase):
    def test_preview_emits_yaml_runtime_node(self) -> None:
        proc = subprocess.run(
            [sys.executable, "-m", "scripts.scan.seed_spec", "--root", str(FIXTURES / "node-react"), "--preview"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        loaded = yaml.safe_load(proc.stdout)
        self.assertEqual(loaded["constraints"]["tech_stack"]["runtime"], "node")
        self.assertIn(loaded["constraints"]["tech_stack"]["language"], {"javascript", "typescript"})

    def test_apply_writes_valid_spec(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target_root = Path(tmp)
            shutil.copytree(FIXTURES / "node-react", target_root / "repo")
            proc = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "scripts.scan.seed_spec",
                    "--root",
                    str(target_root / "repo"),
                    "--apply",
                ],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
            )
            self.assertEqual(proc.returncode, 0, msg=proc.stderr)
            spec_path = target_root / "repo" / ".harness" / "spec.yaml"
            self.assertTrue(spec_path.is_file())
            validate_proc = subprocess.run(
                [sys.executable, "scripts/spec/validate.py", str(spec_path)],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
            )
            self.assertEqual(validate_proc.returncode, 0, msg=validate_proc.stderr or validate_proc.stdout)

    def test_skip_writes_byte_equal_template(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target_root = Path(tmp) / "repo"
            target_root.mkdir()
            proc = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "scripts.scan.seed_spec",
                    "--root",
                    str(target_root),
                    "--skip",
                ],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
            )
            self.assertEqual(proc.returncode, 0, msg=proc.stderr)
            written = (target_root / ".harness" / "spec.yaml").read_bytes()
            self.assertEqual(written, STARTER_TEMPLATE_PATH.read_bytes())


if __name__ == "__main__":
    unittest.main()
