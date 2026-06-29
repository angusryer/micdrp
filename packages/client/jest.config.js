module.exports = {
  rootDir: '.',
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '\\.[jt]sx?$': 'babel-jest',
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  },
  // The default react-native preset only transpiles react-native itself; RN
  // community modules ship untranspiled ESM, so whitelist the ones we use
  // (e.g. react-native-config) for transformation.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-config)/)'
  ]
};
