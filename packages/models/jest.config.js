module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '\\.[jt]sx?$': 'babel-jest'
  },
  rootDir: '.'
};
