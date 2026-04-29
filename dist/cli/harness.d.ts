/**
 * `harness` CLI entry point — single-binary wrapper exposing every
 * ported subsystem as `harness <subcommand>` (F-104).
 *
 * Slash commands shell out here. Each subcommand maps to a single
 * module under `src/` (`work`, `sync`, `check`, `status`, `events`,
 * `metrics`, `validate`, `inbox`).
 *
 * Exit codes:
 *
 *   - `0` — success
 *   - `2` — IO / setup error
 *   - `3` — invalid argument
 *   - `5` — schema validation error
 *   - `6` — drift detected (`harness check`)
 *   - `7` — gate failed (`harness work --run-gate`)
 *
 * @module cli/harness
 */
/** Entry point — parses argv and dispatches. */
export declare function main(argv?: ReadonlyArray<string>): void;
//# sourceMappingURL=harness.d.ts.map