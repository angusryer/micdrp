// Flat config (ESLint 9). Replaces .eslintrc.js — every rule decision below is
// carried over from it verbatim; only the shape changed.
//
// TypeScript rules: https://typescript-eslint.io/rules/
// ESLint rules:     https://eslint.org/docs/latest/rules
// React rules:      https://github.com/jsx-eslint/eslint-plugin-react
// Promise rules:    https://github.com/eslint-community/eslint-plugin-promise

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const promisePlugin = require('eslint-plugin-promise');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      '**/ios/**',
      '**/android/**',
      'scripts/**',
      '**/node_modules/**',
      '**/*.config.js',
      'commitlint.config.ts',
      '**/*dist*/**',
      '**/*logs*/**',
      '**/*cache*/**',
      '**/*deploy*/**',
      '**/__snapshots__/**',
      '.harnex/**'
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strict,
  prettierConfig,

  {
    files: ['packages/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      promise: promisePlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'linebreak-style': ['error', 'unix'],
      // avoidEscape lets a string keep double quotes when it contains an
      // apostrophe (e.g. "Don't have an account?") instead of escaping.
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-var': 'error',
      // A leading underscore is the project's marker for "deliberately unused"
      // — a required positional parameter, or a destructured field kept for
      // documentation.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      'promise/catch-or-return': ['error', { allowFinally: true }],

      // Only the two classic hook rules. react-hooks 7's `recommended` also
      // turns on the React Compiler lints, which flag every Reanimated shared
      // value write ("this value cannot be modified") — a false positive for a
      // type whose whole purpose is mutation off the JS thread.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/boolean-prop-naming': [
        'error',
        // `show` reads as naturally as `is`/`has` for a render toggle.
        { rule: '^(is|has|should|can|will|show|at)[A-Z]([A-Za-z0-9]?)+' }
      ],

      // The `no-unsafe-*` family + unbound-method + restrict-plus-operands are
      // type-checked rules that fire almost entirely on `any` leaking from
      // untyped native/third-party boundaries (react-native-config `Config`,
      // reanimated `SharedValue.value`, supabase responses, test renderers).
      // `tsc --strict` already proves the app's own types are sound, so these
      // are warnings rather than build failures.
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      // Async handlers passed to RN `onPress`/`onRefresh` (typed `() => void`)
      // are safe — RN ignores the return. Keep the rest of the rule's checks.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false }
      ],
      // Lazy require() is deliberate at native boundaries — it keeps a module
      // out of the graph until a device-only path actually needs it, which is
      // what lets these files load under Jest without the native dep.
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  {
    // `require()` for jest mocks/fixtures and `async` test callbacks without an
    // `await` are normal and harmless in test and setup files.
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/jest.setup.js', '**/__tests__/**'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        require: 'readonly',
        module: 'writable',
        __DEV__: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // errors.test.ts throws strings, numbers and plain objects on purpose —
      // classifying them is exactly what AppError.getErrorType does.
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off'
    }
  },

  {
    // Config and setup files sit outside the TS project graph, so the
    // type-checked rules have nothing to read and must be switched off wholesale.
    ...tseslint.configs.disableTypeChecked,
    files: [
      '**/jest.setup.js',
      '**/*.config.js',
      'eslint.config.js',
      'packages/client/index.js'
    ],
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];
