"""F-083 — markdown contract test for the init §0.4 Python/pip prerequisite check.

F-082 added §0.5 dep preflight (pyyaml / tomli detection + offer-to-install).
But §0.5's first line runs `python3 -c "import yaml"` which assumes
`python3` itself is on PATH. F-083 closes that assumption gap by adding
a §0.4 prerequisite check between §0 and §0.5.

This test asserts the markdown contract pieces exist and stay in the
right order so future edits cannot quietly remove them.
"""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
INIT_MD = REPO_ROOT / "commands" / "init.md"


class InitMdPrereqContractTests(unittest.TestCase):
    """F-083 — verify the §0.4 'Python / pip prerequisite check' contract."""

    def setUp(self) -> None:
        self.body = INIT_MD.read_text(encoding="utf-8")

    def test_section_anchor_exists(self) -> None:
        self.assertIn("### 0.4.", self.body)
        self.assertIn("Python / pip prerequisite", self.body)

    def test_detection_bash_probes_python3_binary(self) -> None:
        self.assertIn("command -v python3", self.body)

    def test_detection_bash_probes_python_version(self) -> None:
        # Version probe must reject Python <3.8.
        self.assertIn("sys.version_info >= (3, 8)", self.body)

    def test_detection_bash_probes_pip(self) -> None:
        self.assertIn("python3 -m pip --version", self.body)

    def test_detection_outputs_four_branches(self) -> None:
        self.assertIn("python: missing", self.body)
        self.assertIn("python: too_old", self.body)
        self.assertIn("pip: missing", self.body)
        self.assertIn("prereq: ok", self.body)

    def test_python_missing_install_instructions_per_os(self) -> None:
        """Per-OS install commands must be present so the user can
        self-serve regardless of platform.
        """
        self.assertIn("brew install python", self.body)
        self.assertIn("sudo apt install python3", self.body)
        self.assertIn("sudo dnf install python3", self.body)
        self.assertIn("sudo pacman -S python", self.body)
        self.assertIn("python.org/downloads", self.body)

    def test_python_too_old_branch_documented(self) -> None:
        self.assertIn("pyenv", self.body)
        # Must reference the actual minimum version explicitly.
        self.assertIn("Python 3.8", self.body)

    def test_pip_missing_continues_in_degraded_mode(self) -> None:
        """pip absence must NOT abort — F-081 backstop handles it."""
        self.assertIn("python3 -m ensurepip", self.body)
        self.assertIn("degraded mode", self.body.lower())

    def test_abort_path_does_not_create_harness_dir(self) -> None:
        """The verbiage must explicitly state that the abort path leaves
        the user's machine clean.
        """
        # Either Korean or English phrasing acceptable.
        clean_clause = (
            ".harness/` 디렉터리 생성 전 abort" in self.body
            or "before .harness/ is created" in self.body
            or "before any filesystem changes" in self.body
            or ".harness/ is not created" in self.body
        )
        self.assertTrue(
            clean_clause,
            "abort path must explicitly state that .harness/ is not created",
        )

    def test_section_runs_before_section_05(self) -> None:
        """§0.4 must come before §0.5 so dep preflight only runs after
        prereq check passes."""
        pos_04 = self.body.find("### 0.4.")
        pos_05 = self.body.find("### 0.5.")
        self.assertGreater(pos_04, 0, "§0.4 anchor not found")
        self.assertGreater(pos_05, 0, "§0.5 anchor not found")
        self.assertLess(
            pos_04, pos_05,
            "§0.4 must precede §0.5 — prereq check is a precondition for dep preflight",
        )

    def test_section_runs_after_section_0(self) -> None:
        """§0.4 must come after §0 (Pre-flight) so the existing-install
        check runs first."""
        pos_0 = self.body.find("### 0. Pre-flight")
        pos_04 = self.body.find("### 0.4.")
        self.assertGreater(pos_0, 0, "§0 anchor not found")
        self.assertGreater(pos_04, 0, "§0.4 anchor not found")
        self.assertLess(pos_0, pos_04, "§0.4 must come after §0")

    def test_prereq_check_event_documented(self) -> None:
        self.assertIn("prereq_check", self.body)


if __name__ == "__main__":
    unittest.main()
