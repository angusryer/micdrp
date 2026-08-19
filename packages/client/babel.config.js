module.exports = function (api) {
  // Under Jest, react-native-reanimated is fully mocked (see jest.setup.js), so
  // the worklets babel plugin is neither needed nor installed in the test env.
  // Including it there breaks every suite with a missing-module error.
  const isTest = api.env('test') || process.env.NODE_ENV === 'test';
  api.cache.using(() => (isTest ? 'test' : 'app'));

  return {
    presets: ['module:@react-native/babel-preset'],
    // Reanimated 4 moved its worklet transform into react-native-worklets;
    // reanimated/plugin is now just a re-export. MUST be listed last.
    plugins: isTest ? [] : ['react-native-worklets/plugin']
  };
};
