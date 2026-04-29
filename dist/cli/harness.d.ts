/**
 * `harness` CLI entry point — single-binary wrapper exposing every
 * ported subsystem as `harness <subcommand>` (F-104).
 *
 * Subcommands mirror the existing `python3 scripts/<file>.py` CLIs
 * one-to-one. This is the v1.0 release path entry point; slash
 * commands will eventually shell out to `npx harness <verb>`.
 *
 * Exit codes (mirror Python conventions):
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