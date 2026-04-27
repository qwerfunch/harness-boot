"""F-033 — audit pass: stale `/harness:` rename + README/CLAUDE.md refresh + dogfood self-issues-log seed."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
README = REPO_ROOT / "README.md"
CLAUDE_MD = REPO_ROOT / "CLAUDE.md"
TEMPLATE = REPO_ROOT / "docs" / "templates" / "starter" / "CLAUDE.md.template"
LOCAL_INSTALL = REPO_ROOT / "docs" / "setup" / "local-install.md"
FIRST_RUN = REPO_ROOT / "docs" / "setup" / "first-run-checklist.md"
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
    """AC-2: README 배지 + 본문 v0.10.7 / 883."""

    def test_version_badge_v_10_7(self):
        body = README.read_text(encoding="utf-8")
        self.assertIn("v0.10.7", body, "README 에 v0.10.7 누락")
        self.assertNotIn("v0.9.6", body, "README 에 stale v0.9.6 잔존")

    def test_test_count_883(self):
        body = README.read_text(encoding="utf-8")
        self.assertIn("883", body, "README 에 883 tests 누락")
        # 736/742/764 는 stale (v0.9.x 시기)
        for stale in ("764 tests", "742 tests", "764%20passing"):
            self.assertNotIn(stale, body, f"README 에 stale '{stale}' 잔존")


class ClaudeMdRootTests(unittest.TestCase):
    """AC-3: 루트 CLAUDE.md v0.10.7 + 883 + v0.10.4~7 narrative."""

    def test_current_release_v_10_7(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        self.assertIn("현재 릴리즈**: v0.10.7", body)

    def test_test_count_883(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        self.assertIn("883", body)

    def test_v_10_4_to_7_narrative_present(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        for v in ("v0.10.4", "v0.10.5", "v0.10.6", "v0.10.7"):
            self.assertIn(v, body, f"CLAUDE.md narrative 에서 {v} 누락")

    def test_no_stale_v_10_3_as_current(self):
        body = CLAUDE_MD.read_text(encoding="utf-8")
        # historical 컨텍스트로는 등장 가능하나 "현재 릴리즈": v0.10.3 패턴은 금지.
        self.assertNotIn("현재 릴리즈**: v0.10.3", body)


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
