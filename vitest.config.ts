import {defineConfig} from 'vitest/config';

/**
 * Vitest configuration for the harness-boot TypeScript migration (F-084).
 *
 * Two test surfaces:
 *   - Default `npm test` runs unit tests under tests/, excluding parity
 *     so day-to-day development stays fast.
 *   - `npm run test:parity` runs the Python ↔ TS byte-equal parity
 *     suite. Slow (loads fixtures from disk) but mandatory for
 *     migration safety.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [
      'tests/unit/**/*',
      'tests/integration/**/*',
      'tests/regression/**/*',
      'node_modules/**/*',
      'dist/**/*',
    ],
    environment: 'node',
    globals: false,
    testTimeout: 10000,
  },
});
