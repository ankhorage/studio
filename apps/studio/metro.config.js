const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.emptyModulePath = path.resolve(__dirname, 'metro.empty-module.js');

module.exports = config;
