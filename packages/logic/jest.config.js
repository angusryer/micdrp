/**
 * Pure-TS package: Babel strips the types and Jest runs the result. The
 * ts-jest preset used to be layered under this, but it set its own transform
 * that raced the Babel one — a file could come out with `const` lowered to
 * `var` while its TypeScript generics were left in place, which then failed to
 * parse. One transform, named explicitly, removes the ambiguity.
 */
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { configFile: require.resolve('./babel.config.js') }
    ]
  },
  rootDir: '.'
};
