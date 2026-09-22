// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'schemas/**',
      'coverage/**',
      'test/fixture-site/**',
      'eslint.config.js',
      'vitest.config.ts',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: ['./src/application', './src/infrastructure', './src/cli', './src/sdk'],
              message: 'domain must not import from other layers',
            },
            {
              target: './src/application',
              from: ['./src/infrastructure', './src/cli', './src/sdk'],
              message: 'application may only import domain and its own ports',
            },
            {
              target: './src/infrastructure',
              from: ['./src/cli', './src/sdk'],
              message: 'infrastructure must not import cli or sdk',
            },
            {
              target: './src/sdk',
              from: ['./src/cli'],
              message: 'sdk must not import cli',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/cli/**', 'src/infrastructure/logging/**', 'src/infrastructure/prompts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['test/**'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
