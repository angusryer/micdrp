/**
 * The React Native Jest preset moved out of the react-native package in 0.80+.
 *
 * Only one transform is declared. The previous config listed babel-jest and
 * ts-jest with overlapping patterns, which left it ambiguous which one handled
 * a .ts file — the same ambiguity that, in the pure-TS packages, produced files
 * with `const` lowered to `var` while their TypeScript generics survived.
 */
module.exports = {
  rootDir: '.',
  preset: '@react-native/jest-preset',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: ['./jest.setup.js'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { configFile: require.resolve('./babel.config.js') }
    ]
  },
  // The preset only transpiles react-native itself; the community modules we
  // depend on ship untranspiled ESM, so whitelist them for transformation.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?' +
      '|react-native-config|react-native-reanimated|react-native-worklets' +
      '|react-native-gesture-handler|@react-navigation|react-native-screens' +
      '|react-native-safe-area-context|@shopify/react-native-skia' +
      '|react-native-mmkv|react-native-nitro-modules|react-native-share' +
      '|react-native-audio-api|react-native-keychain|react-native-localize' +
      '|react-native-url-polyfill|@dr.pogodin/react-native-fs' +
      '|@supabase|i18next|react-i18next|xstate|@xstate)/)'
  ],
  // Resolve workspace packages to their TS source for tests.
  moduleNameMapper: {
    '^logic$': '<rootDir>/../logic/src/index.ts',
    '^logic/(.*)$': '<rootDir>/../logic/src/$1',
    '^shared$': '<rootDir>/../shared/src/index.ts',
    '^shared/(.*)$': '<rootDir>/../shared/src/$1'
  }
};
