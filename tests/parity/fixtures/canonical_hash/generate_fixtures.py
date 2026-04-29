#!/usr/bin/env python3
"""Generate Python-side fixtures for the canonical_hash TS parity test.

For each fixture name, this script writes:
  - <name>.json — the canonical input as parseable JSON.
  - <name>.expected.txt — the SHA-256 hex Python's canonical_hash
    produces.
  - <name>.subtree.json — the per-subtree hash bundle (when applicable).

The TS parity test then loads `<name>.json`, runs `canonicalHash`, and
asserts the result equals `<name>.expected.txt`. F-084.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / 'scripts'))

from core import canonical_hash as ch  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent

# Each fixture: (name, value). Names are filesystem-safe slugs.
FIXTURES: list[tuple[str, object]] = [
    ('empty_dict', {}),
    ('empty_list', []),
    ('null', None),
    ('simple_string', 'hello'),
    ('simple_int', 42),
    ('simple_float', 3.14),
    ('simple_bool', True),
    (
        'simple_feature',
        {
            'id': 'F-1',
            'title': 'Skeleton',
            'modules': ['src/main.ts'],
        },
    ),
    (
        'sorted_keys',
        {'z': 1, 'a': 2, 'm': 3, 'b': 4},
    ),
    (
        'nested',
        {
            'outer': {
                'inner': [1, 2, {'key': 'value'}],
                'sibling': None,
            },
        },
    ),
    (
        'unicode_korean',
        {'title': '워킹 스켈레톤', 'desc': '한국어 spec'},
    ),
    (
        'unicode_emoji',
        {'mark': '✅', 'icon': '🛠'},
    ),
    (
        'array_order_matters',
        [3, 1, 2],
    ),
    (
        'mixed_full_spec',
        {
            'version': '2.3.8',
            'project': {'name': 'demo', 'mode': 'prototype'},
            'domain': {
                'entities': [{'name': 'User'}],
                'business_rules': [{'id': 'BR-001', 'rule': 'unique id'}],
            },
            'features': [
                {'id': 'F-0', 'title': 'Skeleton'},
                {'id': 'F-1', 'title': 'Auth'},
            ],
        },
    ),
]


def main() -> int:
    for name, value in FIXTURES:
        # Input is canonical JSON itself so the TS test loads via
        # JSON.parse and gets the same parsed shape Python had.
        (FIXTURES_DIR / f'{name}.json').write_text(
            json.dumps(value, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        digest = ch.canonical_hash(value)
        (FIXTURES_DIR / f'{name}.expected.txt').write_text(
            digest + '\n', encoding='utf-8'
        )
        # For dict-shaped fixtures, also emit subtree bundle.
        if isinstance(value, dict):
            bundle = ch.compute_all(value)
            (FIXTURES_DIR / f'{name}.bundle.json').write_text(
                json.dumps(bundle, indent=2, ensure_ascii=False),
                encoding='utf-8',
            )
        print(f'  [ok] {name:24} → {digest[:12]}...')
    print(f'\nGenerated {len(FIXTURES)} fixtures in {FIXTURES_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
