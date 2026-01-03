// eslint.config.mjs
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  js.configs.recommended,
  ...compat.config({ extends: ['next', 'next/core-web-vitals'] }),

  {
    files: ['**/*.{js,cjs,mjs,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      // include recommended sets
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // hard NOs / global tweaks
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',

      // product-code defaults
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      // allow empty catch (common for typed/narrowed rethrows)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // don’t fail build on Next <Link> nag, but still nudge
      '@next/next/no-html-link-for-pages': 'warn',

      // allow styled-jsx attributes
      'react/no-unknown-property': ['warn', { ignore: ['jsx', 'global'] }],

      '@typescript-eslint/no-this-alias': 'off',

      // disable this rule globally so escaped hyphens (and similar) don't trip files
      'no-useless-escape': 'off',

      // disable ESLint's runtime global-check (TS handles types)
      'no-undef': 'off',
    },
  },

  // QUIET MODE for tests, e2e, postman, scripts & misc tooling
  {
    files: [
      'test/**/*',
      'postman/**/*',
      'e2e/**/*',
      'scripts/**/*',
      'pinecone/**/*',
      'cloudflare/**/*',
      '**/__tests__/**/*',
      '**/*.test.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      // ensure parser sees test tsconfig (so DOM + vitest types are present)
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.vitest,
        ...globals.browser, // RequestInfo, NotificationPermission, etc.
        ...globals.node,
      },
    },
    rules: {
      // disable runtime 'no-undef' for TS files (TS handles types)
      'no-undef': 'off',

      // relaxed rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-useless-escape': 'off',
      'no-misleading-character-class': 'off',
      'no-prototype-builtins': 'off',
      'no-empty': 'off',
      'no-useless-catch': 'off',
      // tests don’t need these:
      'jsx-a11y/alt-text': 'off',
      'react/display-name': 'off',
      'react/require-render-return': 'off',
    },
  },

  // STORIES & STORYBOOK - allow "any" type
  {
    files: ['**/__stories__/**/*', '**/.storybook/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  { files: ['eslint.config.mjs'], rules: { 'import/no-anonymous-default-export': 'off' } },

  // cjs file
  { files: ['next.config.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },

  // ignores
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'build/',
      'dist/',
      'coverage/',
      'storybook-static/',
      'next-env.d.ts',
      'public/*.js',
      'public/*.map',
      'e2e/playwright/wallet/injected-provider.js',
      // cloudflare worker files are not part of the lint/build; ignore them
      'cloudflare/**/*',
    ],
  },
];
