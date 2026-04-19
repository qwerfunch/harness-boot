## Coordination across modules <!-- anchor: coordinate-round-trip -->

When two implementers need to agree on a shared contract (e.g., `auth` exposes a function that `order` consumes):

1. Consumer sends `coordinate` with `summary` = proposed shape, `artifact_path` = proposal doc
2. Producer responds `coordinate` with either `status: completed` (accepted) or `status: blocked` (counter-proposal in new artifact_path)
3. Up to 3 rounds. If unresolved, both escalate to orchestrator with `kind: escalate`
4. The orchestrator either rules on the shape (architect consulted) or blocks both features until the plan is revised

