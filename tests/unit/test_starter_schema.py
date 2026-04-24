"""Ensure shipped spec.yaml variants advertise the JSONSchema via yaml-language-server (F-020)."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

_EXPECTED_PREFIX = "# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/main/docs/schemas/spec.schema.json"


class StarterSchemaTests(unittest.TestCase):
    def test_starter_template_declares_schema(self):
        """docs/templates/starter/spec.yaml.template 첫 줄이 yaml-language-server 스키마 지시자.

        이 주석이 있어야 사용자가 VSCode (redhat.vscode-yaml) · IntelliJ 에서 spec.yaml
        편집 시 자동완성/검증이 동작 (F-020 AC-1)."""
        template = REPO_ROOT / "docs" / "templates" / "starter" / "spec.yaml.template"
        self.assertTrue(template.is_file(), f"missing: {template}")
        first_line = template.read_text(encoding="utf-8").splitlines()[0]
        self.assertEqual(first_line, _EXPECTED_PREFIX)

    def test_harness_boot_self_sample_declares_schema(self):
        """Canonical self-spec 도 같은 $schema 주석으로 IDE 지원 (회귀 방지)."""
        sample = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"
        self.assertTrue(sample.is_file(), f"missing: {sample}")
        first_line = sample.read_text(encoding="utf-8").splitlines()[0]
        self.assertEqual(first_line, _EXPECTED_PREFIX)


class OptionalStarterTemplatesTests(unittest.TestCase):
    """v0.8.9 — .gitignore + conftest.py templates shipped in starter/.

    Referenced by commands/init.md §2.5. Prevents the v0.8.6 e2e regression
    (dirty tree on gate_4 · subprocess smoke failing without PYTHONPATH).
    """

    STARTER = REPO_ROOT / "docs" / "templates" / "starter"

    def test_gitignore_template_ships(self):
        path = self.STARTER / ".gitignore.template"
        self.assertTrue(path.is_file(), f"missing: {path}")
        body = path.read_text(encoding="utf-8")
        # Must ignore all major mutable harness outputs
        for needle in (
            ".harness/events.log",
            ".harness/events.log.*",
            ".harness/state.yaml",
            ".harness/harness.yaml",
            ".harness/domain.md",
            ".harness/architecture.yaml",
            ".harness/_workspace/",
        ):
            self.assertIn(needle, body, f".gitignore.template missing: {needle}")

    def test_gitignore_template_preserves_user_editables(self):
        """spec.yaml · chapters/ · protocols/ 는 ignore 목록 standalone 라인에 없어야 (VCS 대상)."""
        body = (self.STARTER / ".gitignore.template").read_text(encoding="utf-8")
        lines = [l.strip() for l in body.splitlines()]
        for editable in (".harness/spec.yaml", ".harness/chapters/", ".harness/protocols/"):
            self.assertNotIn(editable, lines, f"must not ignore editable: {editable}")

    def test_conftest_template_ships(self):
        path = self.STARTER / "conftest.py.template"
        self.assertTrue(path.is_file(), f"missing: {path}")
        body = path.read_text(encoding="utf-8")
        # Must handle both sys.path + PYTHONPATH
        self.assertIn("sys.path", body)
        self.assertIn("PYTHONPATH", body)
        self.assertIn("src", body.lower())

    def test_init_md_documents_optional_templates(self):
        """commands/init.md 에 §2.5 로 .gitignore + conftest.py 안내 필수."""
        init_md = (REPO_ROOT / "commands" / "init.md").read_text(encoding="utf-8")
        self.assertIn(".gitignore.template", init_md)
        self.assertIn("conftest.py.template", init_md)
        self.assertIn("v0.8.9", init_md)


if __name__ == "__main__":
    unittest.main()
