const path = require('path');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for a Yarn-workspaces monorepo.
 *
 * Two things this has to get right:
 *
 *   1. Start from React Native's default config. Without `getDefaultConfig`
 *      Metro has no transformer, and bundling dies with an opaque
 *      "Cannot read properties of undefined (reading 'transformFile')".
 *
 *   2. Watch the repo root, not `packages/client/node_modules`. Yarn hoists
 *      every dependency to the root, so the per-package directory never
 *      exists and Watchman fails outright when asked to watch it.
 *
 * @type {import('metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  projectRoot,
  // The workspace root covers packages/logic and packages/shared as well as
  // the hoisted node_modules, so a change in either package rebuilds.
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(workspaceRoot, 'node_modules')]
  }
});
