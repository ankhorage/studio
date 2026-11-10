const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const standardPdfjsModulePath = require.resolve('pdfjs-dist/build/pdf.mjs');

const config = getDefaultConfig(__dirname);
config.resolver.emptyModulePath = path.resolve(__dirname, 'metro.empty-module.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'pdfjs-dist/webpack.mjs') {
    return { filePath: standardPdfjsModulePath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
