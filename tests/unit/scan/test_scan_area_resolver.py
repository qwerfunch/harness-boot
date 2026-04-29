"""F-037 — area_resolver: feature.modules[] → AreaRecord cluster."""

from __future__ import annotations

import unittest
from pathlib import Path

from legacy.scripts.scan.area_resolver import AreaRecord, resolve_areas
from legacy.scripts.scan.structure import scan_structure


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "brownfield-repos"


class TestResolveAreas(unittest.TestCase):
    def _structure(self, root: Path) -> dict:
        return scan_structure(root)

    def test_dotted_path_file_maps_when_py_exists(self) -> None:
        feature = {"id": "F-100", "modules": ["legacy/scripts/scan/manifest"]}
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(len(areas), 1)
        area = areas[0]
        self.assertIn("legacy/scripts/scan/manifest.py", area.paths)
        self.assertEqual(area.feature_id, "F-100")
        self.assertEqual(area.modules, ("legacy/scripts/scan/manifest",))

    def test_dotted_path_dir_maps_when_directory_exists(self) -> None:
        feature = {"id": "F-101", "modules": ["legacy/scripts/scan"]}
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(len(areas), 1)
        self.assertIn("legacy/scripts/scan", areas[0].paths)

    def test_sibling_cluster_collapses(self) -> None:
        feature = {
            "id": "F-102",
            "modules": [
                "legacy/scripts/scan/area_resolver",
                "legacy/scripts/scan/style_fingerprint",
                "legacy/scripts/scan/chapter_writer",
            ],
        }
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(len(areas), 1)
        area = areas[0]
        # F-106 — slug now reflects the legacy/scripts depth-2 prefix.
        self.assertEqual(area.slug, "legacy-scripts")
        self.assertEqual(len(area.modules), 3)

    def test_disjoint_modules_yield_distinct_areas(self) -> None:
        # F-106 — after the scripts/ → legacy/scripts/ move, two paths
        # under legacy/scripts/ share the same depth-2 prefix and now
        # cluster into ONE area. We swap to genuinely disjoint depth-2
        # roots (src/ vs legacy/) to keep the disjoint-clustering
        # contract intact.
        feature = {
            "id": "F-103",
            "modules": ["src/core/state.ts", "legacy/scripts/ceremonies/kickoff.py"],
        }
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(len(areas), 2)
        slugs = {a.slug for a in areas}
        self.assertEqual(slugs, {"src-core", "legacy-scripts"})

    def test_unmappable_module_emits_dim_area(self) -> None:
        feature = {"id": "F-104", "modules": ["does/not/exist"]}
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(len(areas), 1)
        self.assertEqual(areas[0].paths, ())
        self.assertTrue(areas[0].slug.startswith("unmapped-"))

    def test_empty_modules_yields_empty_areas(self) -> None:
        feature = {"id": "F-105", "modules": []}
        areas = resolve_areas(
            feature,
            project_root=REPO_ROOT,
            structure=self._structure(REPO_ROOT),
        )
        self.assertEqual(areas, [])

    def test_deterministic_slug_across_module_order(self) -> None:
        ordered = {
            "id": "F-106",
            "modules": [
                "legacy/scripts/scan/manifest",
                "legacy/scripts/scan/structure",
                "legacy/scripts/scan/seed_spec",
            ],
        }
        reordered = {
            "id": "F-106",
            "modules": [
                "legacy/scripts/scan/seed_spec",
                "legacy/scripts/scan/manifest",
                "legacy/scripts/scan/structure",
            ],
        }
        a1 = resolve_areas(
            ordered, project_root=REPO_ROOT, structure=self._structure(REPO_ROOT)
        )
        a2 = resolve_areas(
            reordered, project_root=REPO_ROOT, structure=self._structure(REPO_ROOT)
        )
        self.assertEqual([area.slug for area in a1], [area.slug for area in a2])
        self.assertEqual(a1[0].paths, a2[0].paths)


if __name__ == "__main__":
    unittest.main()
