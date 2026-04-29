"""F-082 — markdown contract test for the init §0.5 preflight section.

The dep preflight is implemented in `commands/init.md` rather than as a
Python helper — the operator (Claude) reads the markdown, runs the
detection bash, asks the user, and branches based on the response.
This test asserts the contract pieces exist and stay in the right
section ordering so future edits cannot quietly remove them.
"""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
INIT_MD = REPO_ROOT / "commands" / "init.md"


class InitMdPreflightContractTests(unittest.TestCase):
    """F-082 — verify the §0.5 'Optional dependency preflight' contract."""

    def setUp(self) -> None:
        self.body = INIT_MD.read_text(encoding="utf-8")

    def test_section_anchor_exists(self) -> None:
        self.assertIn("Optional dependency preflight", self.body)
        self.assertIn("### 0.5.", self.body)

    def test_detection_bash_present(self) -> None:
        # The dep check uses two `python3 -c` probes.
        self.assertIn('python3 -c "import yaml"', self.body)
        self.assertIn('python3 -c "import tomllib"', self.body)
        self.assertIn('python3 -c "import tomli"', self.body)

    def test_user_consent_branches_documented(self) -> None:
        # The three response branches must be explicit so the operator
        # cannot silently auto-install.
        self.assertIn("yes", self.body)
        self.assertIn("no", self.body)
        self.assertIn("venv", self.body)

    def test_pip_install_command_present(self) -> None:
        self.assertIn("python3 -m pip install --user pyyaml", self.body)

    def test_pep_668_fallback_documented(self) -> None:
        self.assertIn("PEP 668", self.body)
        self.assertIn("--break-system-packages", self.body)

    def test_venv_command_present(self) -> None:
        self.assertIn("python3 -m venv", self.body)

    def test_section_runs_before_section_one(self) -> None:
        """§0.5 must come between §0 (pre-flight) and §1 (Create directories)
        so deps are checked before any work begins.
        """
        pos_05 = self.body.find("### 0.5.")
        pos_1 = self.body.find("### 1. Create directories")
        self.assertGreater(pos_05, 0, "§0.5 anchor not found")
        self.assertGreater(pos_1, 0, "§1 anchor not found")
        self.assertLess(
            pos_05, pos_1,
            "§0.5 must precede §1 so deps are validated before work starts",
        )

    def test_never_aborts_init_clause_present(self) -> None:
        # Failsafe statement must be explicit so future edits do not
        # tighten the contract into a hard failure.
        self.assertIn("never abort", self.body.lower())

    def test_deps_preflight_event_documented(self) -> None:
        self.assertIn("deps_preflight", self.body)


if __name__ == "__main__":
    unittest.main()
