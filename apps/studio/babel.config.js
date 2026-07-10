/* global module */

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@root': './',
            '@ankhorage/studio': '../../dist/root.js',
          },
        },
      ],
      // Required for Reanimated. Must be the last plugin.
      'react-native-reanimated/plugin',
    ],
  };
};
