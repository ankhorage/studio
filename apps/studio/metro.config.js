const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const appResolutionAnchor = path.join(__dirname, 'package.json');
const nativeSingletonPackages = [
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isNativeSingleton = nativeSingletonPackages.some(
    (packageName) => moduleName === packageName || moduleName.startsWith(`${packageName}/`),
  );

  return context.resolveRequest(
    isNativeSingleton ? { ...context, originModulePath: appResolutionAnchor } : context,
    moduleName,
    platform,
  );
};

module.exports = config;
