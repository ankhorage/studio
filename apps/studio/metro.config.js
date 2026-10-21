const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.emptyModulePath = path.resolve(__dirname, 'metro.empty-module.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'pdfjs-dist/webpack.mjs') {
    return {
      filePath: require.resolve('pdfjs-dist/build/pdf.mjs'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
