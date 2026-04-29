#!/usr/bin/env python3
"""Generate Python-side fixtures for the state TS parity test (F-086).

For each fixture we record:

  - ``state.yaml`` — the on-disk YAML written by Python's State.save().
    The TS port reads this to verify it parses to the same data shape
    Python's yaml.safe_load yields.
  - ``data.json`` — the expected post-load data shape (what
    yaml.safe_load returns). The TS port asserts equality.
  - ``iron_law.json`` — declared-evidence count expectations indexed by
    feature id. Iron Law math is pure logic and is byte-equal across
    runtimes.

The TS parity test reproduces each scenario by loading the YAML in
TypeScript, asserting data shape == data.json, and asserting
countDeclaredEvidence(...) == iron_law.json[fid] for each fid.

Run from the repo root:

    python3 tests/parity/fixtures/state/generate_fixtures.py
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / 'scripts'))

from core import state as st_mod  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent

# Pinned reference time for declared-evidence math — all fixtures use
# this as their "now" so the generated counts are deterministic.
PIN_NOW = datetime(2026, 5, 1, 0, 0, 0, tzinfo=timezone.utc)
PIN_NOW_ISO = '2026-05-01T00:00:00Z'


def build_empty() -> tuple[dict, dict]:
    """Empty file — should round-trip to default schema with no features."""
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [],
        'session': {
            'started_at': None,
            'last_command': '',
            'last_gate_passed': None,
            'active_feature_id': None,
        },
    }
    iron_law: dict[str, int] = {}
    return state, iron_law


def build_single_feature() -> tuple[dict, dict]:
    """One feature, mid-cycle, with one declared and one automatic evidence."""
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [
            {
                'id': 'F-001',
                'status': 'in_progress',
                'gates': {
                    'gate_0': {
                        'last_result': 'pass',
                        'ts': '2026-04-30T10:00:00Z',
                        'note': 'unit tests green',
                    },
                },
                'evidence': [
                    {
                        'ts': '2026-04-29T08:00:00Z',
                        'kind': 'gate_run',
                        'summary': 'auto-emitted by gate runner',
                    },
                    {
                        'ts': '2026-04-30T11:00:00Z',
                        'kind': 'manual_check',
                        'summary': 'reviewer eyeballed UI',
                    },
                ],
                'started_at': '2026-04-29T07:00:00Z',
                'completed_at': None,
            },
        ],
        'session': {
            'started_at': '2026-04-29T07:00:00Z',
            'last_command': '/harness:work F-001',
            'last_gate_passed': 'gate_0',
            'active_feature_id': 'F-001',
        },
    }
    # Only the manual_check counts (gate_run is automatic).
    iron_law = {'F-001': 1}
    return state, iron_law


def build_full_iron_law() -> tuple[dict, dict]:
    """Feature with five evidence rows hitting every Iron Law branch.

    Branches exercised:
      - declared, recent (within 7d window) → counted
      - declared, old (outside window) → excluded
      - declared, missing ts → counted (conservative)
      - declared, unparseable ts → counted
      - automatic kind (gate_run) → excluded regardless of ts
    """
    # PIN_NOW is 2026-05-01. Window = 7d → cutoff 2026-04-24.
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [
            {
                'id': 'F-002',
                'status': 'in_progress',
                'gates': {},
                'evidence': [
                    {  # recent declared — counts
                        'ts': '2026-04-30T08:00:00Z',
                        'kind': 'manual_check',
                        'summary': 'recent declared',
                    },
                    {  # old declared — excluded
                        'ts': '2026-04-01T08:00:00Z',
                        'kind': 'reviewer_check',
                        'summary': 'old declared (outside window)',
                    },
                    {  # missing ts — counted (conservative)
                        'kind': 'test',
                        'summary': 'missing ts',
                    },
                    {  # unparseable ts — counted
                        'ts': 'not-an-iso-string',
                        'kind': 'user_feedback',
                        'summary': 'unparseable ts',
                    },
                    {  # automatic — excluded
                        'ts': '2026-04-30T09:00:00Z',
                        'kind': 'gate_run',
                        'summary': 'automatic gate_run',
                    },
                ],
                'started_at': '2026-03-25T00:00:00Z',
                'completed_at': None,
            },
        ],
        'session': {
            'started_at': '2026-03-25T00:00:00Z',
            'last_command': '/harness:work F-002',
            'last_gate_passed': None,
            'active_feature_id': 'F-002',
        },
    }
    iron_law = {'F-002': 3}  # recent + missing-ts + unparseable
    return state, iron_law


def build_unicode_summary() -> tuple[dict, dict]:
    """Korean + emoji evidence summaries — verifies UTF-8 round-trip."""
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [
            {
                'id': 'F-003',
                'status': 'done',
                'gates': {
                    'gate_5': {
                        'last_result': 'pass',
                        'ts': '2026-04-30T20:00:00Z',
                        'note': 'smoke 통과 ✅',
                    },
                },
                'evidence': [
                    {
                        'ts': '2026-04-30T20:30:00Z',
                        'kind': 'manual_check',
                        'summary': '한국어 spec — Walking Skeleton 검증',
                    },
                    {
                        'ts': '2026-04-30T21:00:00Z',
                        'kind': 'user_feedback',
                        'summary': '✅ done · 사용자 승인',
                    },
                ],
                'started_at': '2026-04-25T00:00:00Z',
                'completed_at': '2026-04-30T22:00:00Z',
            },
        ],
        'session': {
            'started_at': '2026-04-25T00:00:00Z',
            'last_command': '/harness:work F-003',
            'last_gate_passed': 'gate_5',
            'active_feature_id': None,
        },
    }
    iron_law = {'F-003': 2}
    return state, iron_law


def build_skipped_agents() -> tuple[dict, dict]:
    """Feature with skipped_agents[] populated — v0.5 routing audit trail."""
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [
            {
                'id': 'F-004',
                'status': 'in_progress',
                'gates': {},
                'evidence': [],
                'started_at': '2026-04-30T00:00:00Z',
                'completed_at': None,
                'skipped_agents': [
                    {
                        'agent': 'security-engineer',
                        'reason': 'no sensitive entity, static client only',
                        'ts': '2026-04-30T00:01:00Z',
                    },
                    {
                        'agent': 'audio-designer',
                        'reason': 'ui_surface.has_audio=false',
                        'ts': '2026-04-30T00:02:00Z',
                    },
                ],
            },
        ],
        'session': {
            'started_at': '2026-04-30T00:00:00Z',
            'last_command': '/harness:work F-004',
            'last_gate_passed': None,
            'active_feature_id': 'F-004',
        },
    }
    iron_law = {'F-004': 0}
    return state, iron_law


def build_multi_feature() -> tuple[dict, dict]:
    """Three features at different lifecycle stages."""
    state = {
        'version': '2.3',
        'schema_version': '2.3',
        'features': [
            {
                'id': 'F-010',
                'status': 'done',
                'gates': {},
                'evidence': [
                    {'ts': '2026-04-29T00:00:00Z', 'kind': 'test', 'summary': 'integ green'},
                ],
                'started_at': '2026-04-25T00:00:00Z',
                'completed_at': '2026-04-29T00:00:00Z',
            },
            {
                'id': 'F-011',
                'status': 'blocked',
                'gates': {},
                'evidence': [
                    {'ts': '2026-04-30T00:00:00Z', 'kind': 'blocker', 'summary': 'API missing'},
                ],
                'started_at': '2026-04-28T00:00:00Z',
                'completed_at': None,
            },
            {
                'id': 'F-012',
                'status': 'planned',
                'gates': {},
                'evidence': [],
                'started_at': None,
                'completed_at': None,
            },
        ],
        'session': {
            'started_at': '2026-04-25T00:00:00Z',
            'last_command': '/harness:work F-011',
            'last_gate_passed': None,
            'active_feature_id': 'F-011',
        },
    }
    iron_law = {'F-010': 1, 'F-011': 1, 'F-012': 0}
    return state, iron_law


FIXTURES = {
    'empty': build_empty,
    'single_feature': build_single_feature,
    'full_iron_law': build_full_iron_law,
    'unicode_summary': build_unicode_summary,
    'skipped_agents': build_skipped_agents,
    'multi_feature': build_multi_feature,
}


def write_fixture(name: str, data: dict, iron_law: dict) -> None:
    fixture_dir = FIXTURES_DIR / name
    if fixture_dir.exists():
        shutil.rmtree(fixture_dir)
    fixture_dir.mkdir(parents=True)

    # Write state.yaml exactly as Python's State.save would.
    state_yaml_path = fixture_dir / 'state.yaml'
    state = st_mod.State(path=state_yaml_path, data=data)
    state.save()

    # Snapshot the data shape Python parses back. This is what TS must match.
    reloaded = st_mod.State.load(fixture_dir).data
    (fixture_dir / 'data.json').write_text(
        json.dumps(reloaded, indent=2, ensure_ascii=False),
        encoding='utf-8',
    )

    # Iron Law expectations indexed by feature id.
    (fixture_dir / 'iron_law.json').write_text(
        json.dumps(iron_law, indent=2),
        encoding='utf-8',
    )

    # Pinned-now value the TS test must use when running countDeclaredEvidence.
    (fixture_dir / 'now.txt').write_text(PIN_NOW_ISO, encoding='utf-8')


def main() -> int:
    for name, builder in FIXTURES.items():
        data, iron_law = builder()
        write_fixture(name, data, iron_law)
        print(f'  [ok] {name:24} → features={len(data["features"])}')

    print(f'\nGenerated {len(FIXTURES)} fixtures in {FIXTURES_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
