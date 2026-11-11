import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'uploads/**', 'dist/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['migrations/**/*.js', 'scripts/**/*.js'],
    rules: {
      // Berkas migrasi yang dihasilkan cli dan skrip sekali pakai
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
];
