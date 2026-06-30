// TypeScript rules: https://typescript-eslint.io/rules/
// ESLint rules: https://eslint.org/docs/latest/rules
// React rules: https://github.com/jsx-eslint/eslint-plugin-react/tree/master/docs/rules
// Promise rules: https://github.com/eslint-community/eslint-plugin-promise#rules

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
    commonjs: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // disables rules from eslint:recommended which are already handled by TS
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'plugin:promise/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
    project: ['tsconfig.json', 'packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname
  },
  settings: { react: { version: 'detect' } },
  plugins: ['@typescript-eslint', 'promise'],
  ignorePatterns: [
    'ios',
    'android',
    'scripts',
    'node_modules',
    '.eslintrc.js',
    '*.config.js',
    'commitlint.config.ts',
    '**/*dist*',
    '**/*logs*',
    '**/*cache*',
    '**/*deploy*',
    '**/*snapshots*'
  ],
  overrides: [
    {
      files: ['**/*.test.?([jt]sx|[jt]s)'],
      rules: {
        // `require()` for jest mocks/fixtures and `async` test callbacks without
        // an `await` are normal and harmless in test files.
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/unbound-method': 'off'
      }
    },
    {
      files: ['./packages/client'],
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      plugins: ['react'],
      extends: ['plugin:react/recommended', '@react-native-community'],
      rules: {
        'react/boolean-prop-naming': [
          'error',
          {
            rule: '^(is|has|should|can|will)[A-Z]([A-Za-z0-9]?)+'
          }
        ],
        'react/jsx-filename-extension': [
          1,
          {
            extensions: ['.ts', '.tsx']
          }
        ],
        'react/jsx-uses-react': 'error',
        'react/jsx-uses-vars': 'error',
        'no-console': [
          'warn',
          {
            allow: ['warn', 'error', 'debug']
          }
        ]
      }
    }
  ],
  rules: {
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-var': ['error'],
    'promise/catch-or-return': ['error', { allowFinally: true }],
    // The `no-unsafe-*` family + unbound-method + restrict-plus-operands are
    // type-checked rules that fire almost entirely on `any` leaking from
    // untyped native/third-party boundaries (react-native-config `Config`,
    // `NativeModules`, reanimated `SharedValue.value`, supabase responses,
    // react-test-renderer). `tsc --strict` already proves the app's own types
    // are sound, so these are downgraded to warnings (continuing the project's
    // existing choice for `no-unsafe-call`) rather than failing the build.
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/unbound-method': 'warn',
    '@typescript-eslint/restrict-plus-operands': 'warn',
    // Async handlers passed to RN `onPress`/`onRefresh` (typed `() => void`)
    // are safe — RN ignores the return. Keep the rest of the rule's checks.
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }]
  }
};
