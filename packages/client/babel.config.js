module.exports = function (api) {
  // Under Jest, react-native-reanimated is fully mocked (see jest.setup.js), so
  // the worklets babel plugin is neither needed nor installed in the test env.
  // Including it there breaks every suite with
  // "Cannot find module 'react-native-reanimated/plugin'".
  const isTest = api.env('test') || process.env.NODE_ENV === 'test';
  api.cache.using(() => (isTest ? 'test' : 'app'));

  return {
    presets: ['module:metro-react-native-babel-preset'],
    // react-native-reanimated/plugin MUST be listed last. App builds only.
    plugins: isTest ? [] : ['react-native-reanimated/plugin']
  };
};
