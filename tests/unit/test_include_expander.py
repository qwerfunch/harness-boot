"""Tests for scripts/spec/include_expander.py (F-009; v0.7.5 relocated)."""

from __future__ import annotations

import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from spec import include_expander as ie  # noqa: E402


class ScratchDirMixin:
    """각 테스트마다 임시 chapters 디렉터리를 만들어주는 헬퍼."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.chapters = self.tmp / "chapters"
        self.chapters.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_chapter(self, rel: str, content: str) -> Path:
        path = self.chapters / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(textwrap.dedent(content), encoding="utf-8")
        return path


class FindIncludesTests(ScratchDirMixin, unittest.TestCase):
    """_find_includes() 가 tree 를 제대로 훑는다."""

    def test_no_includes(self):
        spec = {"project": {"name": "p"}, "features": []}
        self.assertEqual(ie._find_includes(spec), [])

    def test_single_include(self):
        spec = {"project": {"description": {"$include": "chapters/desc.md"}}}
        found = ie._find_includes(spec)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["target"], "chapters/desc.md")
        self.assertEqual(found[0]["path"], ("project", "description"))
        self.assertEqual(found[0]["parent_key"], "description")

    def test_nested_in_list(self):
        spec = {
            "features": [
                {"id": "F-1", "description": {"$include": "chapters/f1.md"}},
            ]
        }
        found = ie._find_includes(spec)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["path"], ("features", 0, "description"))
        self.assertEqual(found[0]["parent_key"], "description")

    def test_multi_key_dict_is_not_include(self):
        """`$include` 외에 다른 키가 있으면 전개 대상 아님."""
        spec = {"x": {"$include": "a.md", "other": 1}}
        self.assertEqual(ie._find_includes(spec), [])

    def test_include_node_is_not_recursed(self):
        """$include 값 내부는 더 탐색 안 함 — 값이 경로 문자열임을 전제."""
        spec = {"x": {"$include": "a.md"}}
        found = ie._find_includes(spec)
        self.assertEqual(len(found), 1)


class BasicExpansionTests(ScratchDirMixin, unittest.TestCase):
    """기본 전개 동작."""

    def test_expand_single(self):
        self.write_chapter("desc.md", "안녕 harness!\n")
        spec = {"project": {"description": {"$include": "desc.md"}}}
        out = ie.expand(spec, self.chapters)
        self.assertEqual(out["project"]["description"], "안녕 harness!\n")

    def test_expand_multiple(self):
        self.write_chapter("a.md", "AAA")
        self.write_chapter("b.md", "BBB")
        spec = {
            "x": {"$include": "a.md"},
            "y": {"$include": "b.md"},
        }
        out = ie.expand(spec, self.chapters)
        self.assertEqual(out["x"], "AAA")
        self.assertEqual(out["y"], "BBB")

    def test_no_includes_is_noop(self):
        spec = {"project": {"name": "p"}}
        out = ie.expand(spec, self.chapters)
        # no-op 은 동일 객체(mutate X) OR 같은 내용 객체 반환 허용
        self.assertEqual(out, spec)

    def test_expand_does_not_mutate_input(self):
        self.write_chapter("c.md", "CCC")
        spec = {"x": {"$include": "c.md"}}
        _ = ie.expand(spec, self.chapters)
        # 원본은 그대로
        self.assertEqual(spec, {"x": {"$include": "c.md"}})


class DepthGuardTests(ScratchDirMixin, unittest.TestCase):
    """Depth=1 강제 — 전개된 파일 내부의 $include 문자열은 literal 로 보존."""

    def test_content_with_include_syntax_is_preserved_as_string(self):
        self.write_chapter("outer.md", "outer body\n$include: chapters/inner.md\n")
        self.write_chapter("inner.md", "inner body\n")
        spec = {"x": {"$include": "outer.md"}}
        out = ie.expand(spec, self.chapters)
        # outer 내용이 통째로 문자열로 들어감. $include: 는 그냥 텍스트.
        self.assertIn("outer body", out["x"])
        self.assertIn("$include: chapters/inner.md", out["x"])
        # inner 파일 내용은 포함 안 됨 (depth=2 금지)
        self.assertNotIn("inner body", out["x"])


class LockedFieldTests(ScratchDirMixin, unittest.TestCase):
    """🔒 필드에 $include 삽입 차단."""

    def test_id_rejected(self):
        self.write_chapter("x.md", "foo")
        spec = {"features": [{"id": {"$include": "x.md"}, "name": "f"}]}
        with self.assertRaises(ie.IncludeError) as ctx:
            ie.expand(spec, self.chapters)
        self.assertIn("id", str(ctx.exception))

    def test_version_rejected(self):
        self.write_chapter("v.md", "2.3.8")
        spec = {"version": {"$include": "v.md"}}
        with self.assertRaises(ie.IncludeError):
            ie.expand(spec, self.chapters)

    def test_type_rejected(self):
        self.write_chapter("t.md", "feature")
        spec = {"features": [{"id": "F-1", "type": {"$include": "t.md"}}]}
        with self.assertRaises(ie.IncludeError):
            ie.expand(spec, self.chapters)

    def test_allow_locked_flag_overrides(self):
        self.write_chapter("v.md", "2.3.8")
        spec = {"version": {"$include": "v.md"}}
        out = ie.expand(spec, self.chapters, strict_locked_fields=False)
        self.assertEqual(out["version"], "2.3.8")

    def test_description_field_is_allowed(self):
        """description 은 🗒 필드 — 전개 허용."""
        self.write_chapter("d.md", "long description\n")
        spec = {"project": {"description": {"$include": "d.md"}}}
        out = ie.expand(spec, self.chapters)
        self.assertEqual(out["project"]["description"], "long description\n")


class ErrorHandlingTests(ScratchDirMixin, unittest.TestCase):
    """에러 경로."""

    def test_missing_file(self):
        spec = {"x": {"$include": "does-not-exist.md"}}
        with self.assertRaises(ie.IncludeError) as ctx:
            ie.expand(spec, self.chapters)
        self.assertIn("does-not-exist.md", str(ctx.exception))

    def test_absolute_path_rejected(self):
        spec = {"x": {"$include": "/etc/passwd"}}
        with self.assertRaises(ie.IncludeError):
            ie.expand(spec, self.chapters)

    def test_parent_escape_rejected(self):
        """`..` 로 chapters_dir 밖으로 못 나감."""
        outside = self.tmp / "outside.md"
        outside.write_text("secret", encoding="utf-8")
        spec = {"x": {"$include": "../outside.md"}}
        with self.assertRaises(ie.IncludeError) as ctx:
            ie.expand(spec, self.chapters)
        self.assertIn("벗어남", str(ctx.exception))


class PathResolutionTests(ScratchDirMixin, unittest.TestCase):
    """_resolve_chapters_dir 우선순위."""

    def test_explicit_wins(self):
        explicit = self.tmp / "custom"
        explicit.mkdir()
        result = ie._resolve_chapters_dir(self.tmp / "spec.yaml", explicit)
        self.assertEqual(result, explicit)

    def test_dotharness_chapters_used_if_present(self):
        spec_path = self.tmp / "spec.yaml"
        dotharness = self.tmp / ".harness" / "chapters"
        dotharness.mkdir(parents=True)
        result = ie._resolve_chapters_dir(spec_path, None)
        self.assertEqual(result, dotharness)

    def test_plain_chapters_fallback(self):
        spec_path = self.tmp / "spec.yaml"
        # chapters/ 는 setUp 에서 이미 생성됨
        result = ie._resolve_chapters_dir(spec_path, None)
        self.assertEqual(result, self.chapters)


class IntegrationWithCanonicalHashTests(ScratchDirMixin, unittest.TestCase):
    """F-009 + F-010 결합: expand 전후 해시가 다르고, 같은 expand 는 같은 해시."""

    def test_expand_changes_hash(self):
        from core import canonical_hash as ch

        self.write_chapter("d.md", "bodytext")
        spec = {"project": {"description": {"$include": "d.md"}}}
        hash_raw = ch.canonical_hash(spec)
        expanded = ie.expand(spec, self.chapters)
        hash_expanded = ch.canonical_hash(expanded)
        self.assertNotEqual(hash_raw, hash_expanded)

    def test_expand_is_deterministic(self):
        from core import canonical_hash as ch

        self.write_chapter("d.md", "bodytext")
        spec = {"project": {"description": {"$include": "d.md"}}}
        h1 = ch.canonical_hash(ie.expand(spec, self.chapters))
        h2 = ch.canonical_hash(ie.expand(spec, self.chapters))
        self.assertEqual(h1, h2)


if __name__ == "__main__":
    unittest.main()
