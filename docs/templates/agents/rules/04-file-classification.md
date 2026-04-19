## File Classification for tdd-test-writer <!-- anchor: file-classification-for-tdd-test-writer -->

The "do not read implementation code" rule applies to both `tdd-test-writer` (when generated) and `bdd-writer`:

- **Forbidden**: `src/**/*.{ts,js,py,go,...}` (domain logic files — excluding type/interface definitions)
- **Allowed**: type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`), existing test files (`*.test.*`, `*.spec.*`, `*.bdd.*`), config files, documentation

The implementer agent passes the allowed file list to each sub-agent's prompt. For `bdd-writer` the input is narrower: the feature's `acceptance_test` array plus the above-allowed type headers — no other test files are read.

