module.exports = {
  rootDir: '.',
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '\\.[jt]sx?$': 'babel-jest',
    '^.+\\.(ts|tsx)?$': 'ts-jest'
  }
};
