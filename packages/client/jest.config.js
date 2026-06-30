module.exports = {
  rootDir: '.',
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: ['./jest.setup.js'],
  transform: {
    '\\.[jt]sx?$': 'babel-jest',
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  // The default react-native preset only transpiles react-native itself; the RN
  // community modules we depend on ship untranspiled ESM, so whitelist them for
  // transformation.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-config|react-native-reanimated|react-native-gesture-handler|@react-navigation|react-native-screens|react-native-safe-area-context|@shopify/react-native-skia|react-native-mmkv|react-native-share|react-native-audio-api)/)'
  ],
  // Resolve workspace packages to their TS source for tests.
  moduleNameMapper: {
    '^logic$': '<rootDir>/../logic/src/index.ts',
    '^logic/(.*)$': '<rootDir>/../logic/src/$1',
    '^models$': '<rootDir>/../models/src/index.ts',
    '^models/(.*)$': '<rootDir>/../models/src/$1'
  }
};
