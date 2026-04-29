/**
 * ESLint v9 flat config for the harness-boot TS migration (F-084).
 *
 * Pairs with `.prettierrc.json` — Prettier owns formatting (indent /
 * quotes / semicolons / line length), ESLint owns logical lints
 * (unused vars / strict equality / no-any). `eslint-config-prettier`
 * disables the lint rules that would conflict with Prettier output.
 */

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'scripts/**',
      'tests/unit/**',
      'tests/integration/**',
      'tests/regression/**',
      'tests/parity/fixtures/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'tests/parity/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  prettierConfig,
];
