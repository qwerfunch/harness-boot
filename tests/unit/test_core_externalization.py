"""F-043 — single-source-of-truth contracts for gates / routing / render / dashboard limits."""

from __future__ import annotations

import os
import unittest
from unittest import mock


class TestStandardGates(unittest.TestCase):
    def test_standard_gates_canonical(self) -> None:
        from scripts.core.gates import STANDARD_GATES

        self.assertEqual(STANDARD_GATES, ("gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5"))

    def test_work_alias_matches(self) -> None:
        # work.py's sys.path setup imports core.gates via the bare path,
        # while test_*.py imports scripts.core.gates — so the module objects
        # may be distinct in sys.modules. The contract is value-equality.
        from scripts.core.gates import STANDARD_GATES
        from scripts.work import _STANDARD_GATES

        self.assertEqual(_STANDARD_GATES, STANDARD_GATES)


class TestRoutingExports(unittest.TestCase):
    def test_kickoff_routing_shapes_match_core(self) -> None:
        from scripts.core.routing import ROUTING_SHAPES as core_shapes
        from scripts.ceremonies.kickoff import ROUTING_SHAPES as kickoff_shapes

        self.assertIs(kickoff_shapes, core_shapes)

    def test_kickoff_parallel_groups_match_core(self) -> None:
        from scripts.core.routing import PARALLEL_GROUPS as core_groups
        from scripts.ceremonies.kickoff import PARALLEL_GROUPS as kickoff_groups

        self.assertIs(kickoff_groups, core_groups)


class TestRenderAgentChain(unittest.TestCase):
    def test_no_groups_falls_back_to_comma_join(self) -> None:
        from scripts.ui.render import render_agent_chain

        self.assertEqual(
            render_agent_chain(["a", "b", "c"], []),
            "a, b, c",
        )

    def test_parallel_group_collapses(self) -> None:
        from scripts.ui.render import render_agent_chain

        out = render_agent_chain(["a", "b", "c", "d"], [["b", "c"]])
        self.assertIn("(b ∥ c)", out)
        self.assertIn("a", out)
        self.assertIn("d", out)
        # Sequential separator
        self.assertIn("→", out)


class TestDashboardConfig(unittest.TestCase):
    def test_default_caps(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            from scripts.ui.dashboard_config import (
                max_other_list,
                max_pending_list,
                max_unregistered_list,
            )
            self.assertEqual(max_other_list(), 5)
            self.assertEqual(max_pending_list(), 5)
            self.assertEqual(max_unregistered_list(), 5)

    def test_env_overrides(self) -> None:
        from scripts.ui.dashboard_config import max_other_list, max_pending_list

        with mock.patch.dict(os.environ, {"HARNESS_DASHBOARD_MAX_OTHER": "12"}, clear=False):
            self.assertEqual(max_other_list(), 12)
        with mock.patch.dict(os.environ, {"HARNESS_DASHBOARD_MAX_PENDING": "0"}, clear=False):
            # invalid (≤ 0) falls back to default
            self.assertEqual(max_pending_list(), 5)
        with mock.patch.dict(os.environ, {"HARNESS_DASHBOARD_MAX_OTHER": "garbage"}, clear=False):
            self.assertEqual(max_other_list(), 5)


if __name__ == "__main__":
    unittest.main()
