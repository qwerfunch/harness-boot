"""Gate runners — automated BR-004 (Iron Law) evidence collection.

Single module:

- ``runner`` — auto-detect + execute gate_0 … gate_5 plus gate_perf (v0.7.3).
  Consumer is ``scripts.work`` via ``run_and_record_gate``.

Extension strategy: new gate types ship as additional ``run_gate_<name>``
functions inside ``runner`` plus a dispatcher entry. Do **not** create
per-gate files — the dispatch table in ``runner.run_gate`` is a feature.
"""
