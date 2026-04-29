"""Four collaboration ceremonies from the v0.6 orchestration model.

Modules:

- ``kickoff``       — per-feature activation template (v0.7 auto-wired from
                      ``scripts.work.activate``).
- ``retro``         — per-feature retrospective template + events.log
                      analysis (v0.7 auto-wired from ``scripts.work.complete``).
- ``design_review`` — fixed-reviewer design review template (manual invocation
                      in v0.7; auto-wire slated for v0.8+).
- ``inbox``         — file-based Q&A protocol poller.

Event schema contract shared across ceremonies: the feature id key is
``feature`` (not ``feature_id``); the completion event type is
``feature_done`` (not ``feature_completed``). This contract originates in
``scripts.work`` (canonical emitter) and was aligned in v0.6.1.
"""
