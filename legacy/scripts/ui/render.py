"""F-043 — single render for an agent chain (sequence + parallel groups).

``scripts/work.py`` and ``scripts/ui/dashboard.py`` previously kept
near-identical 33-line copies of ``_render_agent_chain`` /
``_render_chain``. F-043 centralizes the renderer here.

The function is pure: takes the resolved agent list and the parallel
groups, returns the formatted string. No I/O.
"""

from __future__ import annotations


PARALLEL_TOKEN: str = " ∥ "
SEQUENCE_TOKEN: str = " → "
COMMA_JOIN: str = ", "


def render_agent_chain(
    agents: list[str],
    groups: list[list[str]],
    *,
    parallel_token: str = PARALLEL_TOKEN,
    sequence_token: str = SEQUENCE_TOKEN,
    comma_join: str = COMMA_JOIN,
) -> str:
    """Render an agent chain for both ``work.py`` activate output and the
    dashboard's ``agent chain:`` line.

    Args:
        agents: ordered, deduped agent list (the kickoff routing result).
        groups: list of agent groups that may run in parallel; each group
            is a list of agent names.
        parallel_token: the separator inside a parallel group (default
            ``" ∥ "``).
        sequence_token: the separator between sequential steps (default
            ``" → "``).
        comma_join: fallback joiner used when there are no parallel
            groups (preserves the pre-F-039 zero-diff behavior).

    Returns:
        - ``", ".join(agents)`` when ``groups`` is empty (legacy zero-diff).
        - Otherwise a chain like ``a → (b ∥ c) → d`` collapsing each
          contiguous run that lives inside a declared group into a single
          parenthesized parallel block.
    """
    if not groups:
        return comma_join.join(agents)

    group_sets = [set(g) for g in groups]
    parts: list[str] = []
    i = 0
    while i < len(agents):
        member = agents[i]
        matched = next((gs for gs in group_sets if member in gs), None)
        if matched is None:
            parts.append(member)
            i += 1
            continue
        block: list[str] = []
        while i < len(agents) and agents[i] in matched:
            block.append(agents[i])
            i += 1
        if len(block) >= 2:
            parts.append("(" + parallel_token.join(block).strip() + ")")
        else:
            parts.append(block[0])
    return sequence_token.join(parts).strip()


__all__ = ["render_agent_chain", "PARALLEL_TOKEN", "SEQUENCE_TOKEN", "COMMA_JOIN"]
