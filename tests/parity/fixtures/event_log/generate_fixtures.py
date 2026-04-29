#!/usr/bin/env python3
"""Generate Python-side fixtures for the eventLog TS parity test.

For each fixture we record an initial state of the harness directory
(events.log + optional pre-existing events.log.YYYYMM buckets), the
`now_yyyymm` boundary used for rotation, and the post-rotation state
plus the move map. The TS parity test reproduces the same input on a
fresh tmp dir, calls `rotate()`, and asserts byte-equal output.

Run from the repo root:

    python3 tests/parity/fixtures/event_log/generate_fixtures.py
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / 'scripts'))

from core import event_log as el  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent

# Each fixture is a dict with these slots:
#   name: filesystem-safe slug
#   initial: { 'events.log': '<json lines>', 'events.log.YYYYMM': '...', ... }
#   now_yyyymm: rotation boundary
#   read_expected: ordered list of events readEvents should yield
#                  before rotation runs
FIXTURES: list[dict] = [
    {
        'name': 'empty_dir',
        'initial': {},
        'now_yyyymm': '202604',
        'read_expected': [],
    },
    {
        'name': 'empty_log_only',
        'initial': {'events.log': ''},
        'now_yyyymm': '202604',
        'read_expected': [],
    },
    {
        'name': 'single_current_month',
        'initial': {
            'events.log': json.dumps({'ts': '2026-04-01T00:00:00Z', 'type': 'a'}) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [{'ts': '2026-04-01T00:00:00Z', 'type': 'a'}],
    },
    {
        'name': 'multi_month_split',
        'initial': {
            'events.log': '\n'.join(
                json.dumps(ev) for ev in [
                    {'ts': '2026-02-15T00:00:00Z', 'type': 'old_feb'},
                    {'ts': '2026-03-10T00:00:00Z', 'type': 'old_mar'},
                    {'ts': '2026-04-01T00:00:00Z', 'type': 'cur_apr'},
                ]
            ) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [
            {'ts': '2026-02-15T00:00:00Z', 'type': 'old_feb'},
            {'ts': '2026-03-10T00:00:00Z', 'type': 'old_mar'},
            {'ts': '2026-04-01T00:00:00Z', 'type': 'cur_apr'},
        ],
    },
    {
        'name': 'unparseable_ts_kept',
        'initial': {
            'events.log': '\n'.join(
                json.dumps(ev) for ev in [
                    {'ts': 'not-an-iso', 'type': 'broken'},
                    {'ts': '2026-02-01T00:00:00Z', 'type': 'old_feb'},
                ]
            ) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [
            {'ts': '2026-02-01T00:00:00Z', 'type': 'old_feb'},
            {'ts': 'not-an-iso', 'type': 'broken'},
        ],
    },
    {
        'name': 'pre_existing_bucket',
        'initial': {
            'events.log.202602': json.dumps({'ts': '2026-02-15T00:00:00Z', 'type': 'historical'}) + '\n',
            'events.log': '\n'.join(
                json.dumps(ev) for ev in [
                    {'ts': '2026-02-20T00:00:00Z', 'type': 'new_feb'},
                    {'ts': '2026-04-01T00:00:00Z', 'type': 'cur_apr'},
                ]
            ) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [
            {'ts': '2026-02-15T00:00:00Z', 'type': 'historical'},
            {'ts': '2026-02-20T00:00:00Z', 'type': 'new_feb'},
            {'ts': '2026-04-01T00:00:00Z', 'type': 'cur_apr'},
        ],
    },
    {
        'name': 'unicode_summary',
        'initial': {
            'events.log': '\n'.join(
                json.dumps(ev, ensure_ascii=False) for ev in [
                    {'ts': '2026-02-01T00:00:00Z', 'type': 'old', 'summary': '한국어 spec'},
                    {'ts': '2026-04-01T00:00:00Z', 'type': 'cur', 'summary': '✅ done'},
                ]
            ) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [
            {'ts': '2026-02-01T00:00:00Z', 'type': 'old', 'summary': '한국어 spec'},
            {'ts': '2026-04-01T00:00:00Z', 'type': 'cur', 'summary': '✅ done'},
        ],
    },
    {
        'name': 'large_bucket',
        'initial': {
            'events.log': '\n'.join(
                json.dumps({'ts': f'2026-02-{day:02d}T00:00:00Z', 'type': 'evt', 'i': day})
                for day in range(1, 11)
            ) + '\n',
        },
        'now_yyyymm': '202604',
        'read_expected': [
            {'ts': f'2026-02-{day:02d}T00:00:00Z', 'type': 'evt', 'i': day}
            for day in range(1, 11)
        ],
    },
]


def write_state(target: Path, state: dict) -> None:
    """Recreate ``target`` directory from a {filename: contents} dict."""
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for name, contents in state.items():
        (target / name).write_text(contents, encoding='utf-8')


def capture_state(target: Path) -> dict:
    """Read every events.log* file under ``target`` into a state dict."""
    out: dict[str, str] = {}
    for p in sorted(target.iterdir()):
        if p.is_file() and (p.name == 'events.log' or el._ROTATED_FILENAME_RE.match(p.name)):
            out[p.name] = p.read_text(encoding='utf-8')
    return out


def main() -> int:
    for fx in FIXTURES:
        name = fx['name']
        fixture_dir = FIXTURES_DIR / name
        fixture_dir.mkdir(exist_ok=True)

        # Snapshot inputs verbatim.
        (fixture_dir / 'initial.json').write_text(
            json.dumps(fx['initial'], indent=2, ensure_ascii=False),
            encoding='utf-8',
        )
        (fixture_dir / 'now_yyyymm.txt').write_text(fx['now_yyyymm'], encoding='utf-8')
        (fixture_dir / 'read_expected.json').write_text(
            json.dumps(fx['read_expected'], indent=2, ensure_ascii=False),
            encoding='utf-8',
        )

        # Run rotate against a tmp work dir to capture expected state.
        work = fixture_dir / '_work'
        write_state(work, fx['initial'])
        moved = el.rotate(work, now_yyyymm=fx['now_yyyymm'])
        post_state = capture_state(work)
        shutil.rmtree(work)

        (fixture_dir / 'expected_post_state.json').write_text(
            json.dumps(post_state, indent=2, ensure_ascii=False),
            encoding='utf-8',
        )
        (fixture_dir / 'expected_moved.json').write_text(
            json.dumps(moved, indent=2),
            encoding='utf-8',
        )

        print(f'  [ok] {name:32} → moved={moved}')

    print(f'\nGenerated {len(FIXTURES)} fixtures in {FIXTURES_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
