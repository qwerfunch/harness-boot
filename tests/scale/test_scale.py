"""F-031 — scaling stress tests.

Validates the threshold hypothesis (300 / 1000 / 3000 / 10000 features)
with actual measurements. NOT discovered by ``tests/unit`` discovery —
invoke explicitly:

    python3 -m unittest tests.scale.test_scale

Each test prints a wall-time table to stdout. Failures only on extreme
regressions (e.g. 10000-feature parse > 30s). Otherwise informational.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.core.canonical_hash import compute_all as _spec_hash_all  # noqa: E402
from scripts.spec.summary import build_summary  # noqa: E402
import jsonschema  # noqa: E402


SCHEMA_PATH = REPO_ROOT / "docs" / "schemas" / "spec.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _fake_feature(idx: int) -> dict:
    fid = f"F-{idx:05d}"
    if idx == 1:
        return {"id": fid, "type": "skeleton", "name": "skeleton", "area": "core"}
    return {
        "id": fid,
        "type": "feature",
        "name": f"fake feature {idx}",
        "area": ["auth", "billing", "obs", "core", "data"][idx % 5],
        "digest": f"fake digest line for feature {idx}",
        "modules": [f"module_{idx}_a", f"module_{idx}_b"],
        "test_strategy": "contract",
        "tdd_focus": [f"focus point {idx}"],
        "acceptance_criteria": [f"AC-1: criterion {idx}"],
    }


def _fake_spec(n_features: int) -> dict:
    return {
        "version": "2.3.8",
        "project": {"name": "stress-spec", "summary": f"{n_features}-feature synthetic"},
        "domain": {"overview": "stress"},
        "features": [_fake_feature(i + 1) for i in range(n_features)],
    }


def _measure(label: str, fn) -> tuple[str, float]:
    start = time.perf_counter()
    fn()
    elapsed = time.perf_counter() - start
    return label, elapsed


_RESULTS: list[tuple[int, list[tuple[str, float]]]] = []


def _print_table() -> None:
    if not _RESULTS:
        return
    print("\n" + "=" * 70)
    print(" Scaling stress — wall time per operation (seconds)")
    print("=" * 70)
    labels = sorted({lab for _, rows in _RESULTS for lab, _ in rows})
    header = "  N        " + "".join(f"{lab:>14}" for lab in labels)
    print(header)
    print("-" * len(header))
    for n, rows in _RESULTS:
        d = dict(rows)
        line = f"  {n:<8}" + "".join(f"{d.get(lab, 0):>14.4f}" for lab in labels)
        print(line)
    print("=" * 70 + "\n")


class _ScaleHarness:
    """Helper: run the suite of measurements for a given N."""

    @staticmethod
    def run_for(n: int) -> list[tuple[str, float]]:
        spec = _fake_spec(n)
        rows: list[tuple[str, float]] = []

        # 1. yaml dump (write spec)
        rows.append(_measure("yaml_dump", lambda: yaml.dump(spec, sort_keys=False)))

        # 2. yaml load (parse fresh)
        text = yaml.dump(spec, sort_keys=False)
        rows.append(_measure("yaml_load", lambda: yaml.safe_load(text)))

        # 3. validate against JSONSchema
        rows.append(_measure("validate", lambda: jsonschema.validate(spec, SCHEMA)))

        # 4. canonical hash (Merkle)
        rows.append(_measure("hash", lambda: _spec_hash_all(spec)))

        # 5. summary index
        rows.append(_measure("summary", lambda: build_summary(spec)))

        return rows


class ScalingStressTests(unittest.TestCase):
    """Print a wall-time table for each N. Hard fail only on extreme regressions."""

    HARD_FAIL_SECONDS = 60.0  # any single op > 60s is broken

    def _run(self, n: int) -> None:
        rows = _ScaleHarness.run_for(n)
        _RESULTS.append((n, rows))
        for label, t in rows:
            self.assertLess(
                t,
                self.HARD_FAIL_SECONDS,
                f"N={n} {label} took {t:.2f}s (>60s — regression)",
            )

    def test_100_features(self):
        self._run(100)

    def test_1000_features(self):
        self._run(1000)

    @unittest.skipUnless(os.environ.get("HARNESS_SCALE_FULL"), "set HARNESS_SCALE_FULL=1 for 3000+ run")
    def test_3000_features(self):
        self._run(3000)

    @unittest.skipUnless(os.environ.get("HARNESS_SCALE_FULL"), "set HARNESS_SCALE_FULL=1 for 10000 run")
    def test_10000_features(self):
        self._run(10000)


def tearDownModule():  # noqa: N802 — unittest hook name
    _print_table()


if __name__ == "__main__":
    unittest.main()
