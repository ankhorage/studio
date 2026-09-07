const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.emptyModulePath = path.resolve(__dirname, 'metro.empty-module.js');
const projectRootPrefix = escapeRegExp(path.resolve(__dirname)) + '[\\/]';
const ancestorNodeModules = new RegExp('^(?!' + projectRootPrefix + ').*[\\/]node_modules[\\/]');
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList)
    ? defaultBlockList
    : defaultBlockList
      ? [defaultBlockList]
      : []),
  ancestorNodeModules,
];

module.exports = config;

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]\^$+*?.-]/g, '\\$&');
}
