"""F-039 — PARALLEL_GROUPS + parallel_groups_for_shapes contract."""

from __future__ import annotations

import unittest

from scripts.ceremonies.kickoff import (
    PARALLEL_GROUPS,
    parallel_groups_for_shapes,
)


class TestParallelGroupsConstant(unittest.TestCase):
    def test_sensitive_or_auth_pairs_security_and_reviewer(self) -> None:
        self.assertEqual(
            PARALLEL_GROUPS["sensitive_or_auth"],
            [("security-engineer", "reviewer")],
        )

    def test_ui_surface_pairs_visual_and_audio_designer(self) -> None:
        self.assertEqual(
            PARALLEL_GROUPS["ui_surface.present"],
            [("visual-designer", "audio-designer")],
        )


class TestParallelGroupsHelper(unittest.TestCase):
    def test_sensitive_or_auth_returns_security_reviewer_pair(self) -> None:
        groups = parallel_groups_for_shapes(["sensitive_or_auth"], has_audio=False)
        self.assertEqual(groups, [("security-engineer", "reviewer")])

    def test_ui_surface_drops_audio_designer_when_no_audio(self) -> None:
        groups = parallel_groups_for_shapes(["ui_surface.present"], has_audio=False)
        # visual-designer alone is not a parallel group → drop entirely
        self.assertEqual(groups, [])

    def test_ui_surface_keeps_pair_when_has_audio(self) -> None:
        groups = parallel_groups_for_shapes(["ui_surface.present"], has_audio=True)
        self.assertIn(("visual-designer", "audio-designer"), groups)

    def test_unknown_shape_yields_empty(self) -> None:
        groups = parallel_groups_for_shapes(["pure_domain_logic"], has_audio=False)
        self.assertEqual(groups, [])

    def test_combined_shapes_collect_all_groups(self) -> None:
        groups = parallel_groups_for_shapes(
            ["sensitive_or_auth", "ui_surface.present"],
            has_audio=True,
        )
        self.assertIn(("security-engineer", "reviewer"), groups)
        self.assertIn(("visual-designer", "audio-designer"), groups)


if __name__ == "__main__":
    unittest.main()
