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


if __name__ == "__main__":
    unittest.main()
