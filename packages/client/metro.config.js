const path = require('path');

// https://stackoverflow.com/questions/62163387/react-native-cannot-find-node-modules-that-exists-this-probably-only-occurs-whe
// https://medium.com/@huntie/a-concise-guide-to-configuring-react-native-with-yarn-workspaces-d7efa71b6906
const watchFolders = [
  path.resolve(__dirname),
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', '..', 'node_modules')
];

module.exports = {
  resetCache: true,
  projectRoot: path.resolve(__dirname),
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false
      }
    })
  },
  watchFolders
};
