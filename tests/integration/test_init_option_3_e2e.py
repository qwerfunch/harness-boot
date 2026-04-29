"""F-036 — `/harness-boot:init` option 3 (brownfield seed) end-to-end.

Simulates the deterministic part of the option-3 sequence in init.md §2.A:
preview → apply → schema validate. The LLM portion (entities, overview)
is not exercised here; that is covered by the brownfield adapter contract
test plus a snapshot fixture round-trip.

Runs outside the default ``tests/unit`` pytest scope (``pytest.ini``).
Invoke explicitly: ``python3 -m pytest tests/integration/test_init_option_3_e2e.py``.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "brownfield-repos"


def _run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, cwd=REPO_ROOT)


class TestOptionThreeNodeRepo(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.target_root = Path(self._tmp.name) / "node-react"
        shutil.copytree(FIXTURES / "node-react", self.target_root)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_preview_contains_runtime_node(self) -> None:
        proc = _run([
            sys.executable,
            "-m",
            "legacy.scripts.scan.seed_spec",
            "--root",
            str(self.target_root),
            "--preview",
        ])
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        seed = yaml.safe_load(proc.stdout)
        self.assertEqual(seed["constraints"]["tech_stack"]["runtime"], "node")
        self.assertEqual(seed["metadata"]["source"]["origin"], "existing_code")

    def test_apply_then_validate(self) -> None:
        apply_proc = _run([
            sys.executable,
            "-m",
            "legacy.scripts.scan.seed_spec",
            "--root",
            str(self.target_root),
            "--apply",
        ])
        self.assertEqual(apply_proc.returncode, 0, msg=apply_proc.stderr)
        spec_path = self.target_root / ".harness" / "spec.yaml"
        self.assertTrue(spec_path.is_file())

        validate_proc = _run([
            sys.executable,
            "legacy/scripts/spec/validate.py",
            str(spec_path),
        ])
        self.assertEqual(
            validate_proc.returncode,
            0,
            msg=validate_proc.stderr or validate_proc.stdout,
        )

    def test_skip_yields_starter_template_byte_equal(self) -> None:
        skip_proc = _run([
            sys.executable,
            "-m",
            "legacy.scripts.scan.seed_spec",
            "--root",
            str(self.target_root),
            "--skip",
        ])
        self.assertEqual(skip_proc.returncode, 0, msg=skip_proc.stderr)
        spec_path = self.target_root / ".harness" / "spec.yaml"
        starter = REPO_ROOT / "docs" / "templates" / "starter" / "spec.yaml.template"
        self.assertEqual(spec_path.read_bytes(), starter.read_bytes())


class TestOptionThreeFallbackEmptyRepo(unittest.TestCase):
    def test_apply_on_empty_repo_still_validates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            empty = Path(tmp) / "empty-repo"
            empty.mkdir()
            apply_proc = _run([
                sys.executable,
                "-m",
                "legacy.scripts.scan.seed_spec",
                "--root",
                str(empty),
                "--apply",
            ])
            self.assertEqual(apply_proc.returncode, 0, msg=apply_proc.stderr)
            spec_path = empty / ".harness" / "spec.yaml"
            self.assertTrue(spec_path.is_file())
            validate_proc = _run([
                sys.executable,
                "legacy/scripts/spec/validate.py",
                str(spec_path),
            ])
            self.assertEqual(
                validate_proc.returncode,
                0,
                msg=validate_proc.stderr or validate_proc.stdout,
            )


if __name__ == "__main__":
    unittest.main()
