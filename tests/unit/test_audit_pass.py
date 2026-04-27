"""F-033 — audit pass: stale `/harness:` rename + README/CLAUDE.md refresh + dogfood self-issues-log seed."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
README = REPO_ROOT / "README.md"
CLAUDE_MD = REPO_ROOT / "CLAUDE.md"
TEMPLATE = REPO_ROOT / "docs" / "templates" / "starter" / "CLAUDE.md.template"
# F-042 — moved under docs/archive/ as part of the doc cleanup; the
# deprecation-notice contract still applies to the archived copies.
LOCAL_INSTALL = REPO_ROOT / "docs" / "archive" / "local-install-v0.1.0.md"
FIRST_RUN = REPO_ROOT / "docs" / "archive" / "first-run-checklist-v0.1.0.md"
ISSUES_LOG = REPO_ROOT / ".harness" / "_workspace" / "issues-log.md"


def _grep_count(path: Path, needle: str) -> int:
    return path.read_text(encoding="utf-8").count(needle)


class StaleRenameTests(unittest.TestCase):
    """AC-1: starter template + setup docs 의 stale `/harness:` 처리.

    starter/CLAUDE.md.template: 0 stale (새 사용자 프로젝트에 깨끗한 컨텐츠).
    setup docs (local-install · first-run-checklist): historical 로 deprecated 헤더
    를 추가했으므로 본문 잔존 허용 — 단 헤더에 'Notice (v0.10.7)' 가 있어야.
    """

    def test_template_has_no_stale_harness_prefix(self):
        body = TEMPLATE.read_text(encoding="utf-8")
        self.assertNotIn("/harness:", body, "CLAUDE.md.template 에 stale /harness: 잔존")

    def test_template_uses_new_namespace(self):
        body = TEMPLATE.read_text(encoding="utf-8")
        self.assertIn("/harness-boot:", body, "template 에 /harness-boot: 미등장")

    def test_local_install_has_deprecation_notice(self):
        body = LOCAL_INSTALL.read_text(encoding="utf-8")
        self.assertIn("Notice (v0.10.7)", body, "local-install.md 에 deprecation 헤더 누락")

    def test_first_run_has_deprecation_notice(self):
        body = FIRST_RUN.read_text(encoding="utf-8")
        self.assertIn("Notice (v0.10.7)", body, "first-run-checklist.md 에 deprecation 헤더 누락")


class ReadmeRefreshTests(unittest.TestCase):
    """AC-2: README badge + body track the latest release."""

    def test_version_badge_pattern(self):
        # F-049 — track the badge pattern instead of pinning a specific version.
        # README is refreshed every minor / patch bump.
        body = README.read_text(encoding="utf-8")
        self.assertRegex(body, r"plugin-v\d+\.\d+\.\d+-blue", "README plugin badge missing")
        # Stale tags from earlier minors must not linger as the visible badge.
        for stale in ("plugin-v0.9.6-blue", "plugin-v0.10.7-blue"):
            self.assertNotIn(stale, body, f"README still shows stale badge '{stale}'")

    def test_test_count_pattern(self):
        body = README.read_text(encoding="utf-8")
        # Track the badge pattern; the exact number floats with each release.
        self.assertRegex(body, r"tests-\d{3,5}%20passing-brightgreen", "README tests badge missing")
        # Stale counts from earlier releases must not remain on the badge.
        for stale in ("tests-764%20passing", "tests-742%20passing", "tests-883%20passing"):
            self.assertNotIn(stale, body, f"README still shows stale tests badge '{stale}'")


class ClaudeMdRootTests(unittest.TestCase):
    """AC-3: root CLAUDE.md current-release marker + recent-narrative coverage."""

    def test_current_release_marker_present(self):
        # F-049 — markers are now in English ("Current release"), per the F-049
        # native-English consolidation. The pattern, not a specific version,
        # is what we track.
        body = CLAUDE_MD.read_text(encoding="utf-8")
        self.assertRegex(body, r"\*\*Current release\*\*:\s*v\d+\.\d+\.\d+")

    def test_test_count_present(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        # CLAUDE.md should mention an integration-or-larger test count to anchor
        # the "where we are" snapshot. The exact number floats.
        self.assertRegex(body, r"\b\d{3,5}\s*\(", "CLAUDE.md test-count anchor missing")

    def test_recent_narrative_present(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        # The recent-history narrative should still cover v0.10.4 through the
        # current release line. We anchor on a few key markers rather than
        # every patch.
        for v in ("v0.10.4", "v0.10.7", "v0.11.0", "v0.11.1"):
            self.assertIn(v, body, f"CLAUDE.md narrative missing {v}")

    def test_no_stale_release_marker(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        # Old "current release" pinning patterns must not appear at the
        # current-release line.
        for stale in (
            "**Current release**: v0.10.3",
            "**Current release**: v0.10.7",
            "현재 릴리즈**: v0.10.3",
        ):
            self.assertNotIn(stale, body, f"CLAUDE.md still pins stale current release: {stale!r}")


class DogfoodIssuesLogTests(unittest.TestCase):
    """AC-5: 본 레포의 dogfood issues-log 가 채워짐."""

    def test_issues_log_exists(self):
        self.assertTrue(ISSUES_LOG.is_file(), f"missing: {ISSUES_LOG}")

    def test_issues_log_header_correct(self):
        body = ISSUES_LOG.read_text(encoding="utf-8")
        self.assertIn("ISSUES-LOG", body)
        self.assertIn("Phase 2 dogfood", body)

    def test_issues_log_has_at_least_5_entries(self):
        body = ISSUES_LOG.read_text(encoding="utf-8")
        # entry heading pattern: "## YYYY-MM-DDT..."
        entry_count = sum(1 for ln in body.splitlines() if ln.startswith("## 2026-"))
        self.assertGreaterEqual(entry_count, 5, f"issues-log entries < 5 (got {entry_count})")

    def test_issues_log_uses_required_fields(self):
        body = ISSUES_LOG.read_text(encoding="utf-8")
        for field in ("Source", "Category", "Severity", "What happened", "Suggested fix"):
            self.assertIn(f"**{field}**", body, f"issues-log 에 필수 필드 '{field}' 누락")


class SchemaArchiveDocClarificationTests(unittest.TestCase):
    """AC-4: archived_at / archive_reason 의 declarative 의미 명시."""

    def test_schema_archived_at_marks_declarative(self):
        body = (REPO_ROOT / "docs" / "schemas" / "spec.schema.json").read_text(encoding="utf-8")
        # description 안에 'declarative' + 'work.py 가 자동 채우지 않음' 명시.
        self.assertIn("declarative", body)
        self.assertIn("자동 채우지 않음", body)


if __name__ == "__main__":
    unittest.main()
