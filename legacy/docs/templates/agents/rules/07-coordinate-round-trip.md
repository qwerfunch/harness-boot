## Coordination across modules <!-- anchor: coordinate-round-trip -->

Subagent Dispatch has no live inter-agent channel, so coordination is always orchestrator-brokered:

1. **Consumer requests.** The consumer implementer writes `_workspace/handoff/implementer-<consumer>->orchestrator.md` with `kind: coordinate`, `status: blocked`, and `artifact_path` pointing to a proposal doc (e.g., proposed function signature).
2. **Orchestrator brokers.** On the next dispatch round, the orchestrator dispatches the producer implementer with a prompt that references the consumer's proposal.
3. **Producer responds.** The producer writes `_workspace/handoff/implementer-<producer>->orchestrator.md` with either `status: completed` (accepted — signature inlined in summary) or `status: blocked` (counter-proposal in a new artifact_path).
4. Up to 3 rounds. If unresolved, both implementers escalate with `kind: escalate`. The orchestrator either rules on the shape (architect consulted) or blocks both features until the plan is revised.

