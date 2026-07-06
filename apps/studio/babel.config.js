/* eslint-env commonjs */

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
          },
        },
      ],
      // Required for Reanimated. Must be the last plugin.
      'react-native-reanimated/plugin',
    ],
  };
};
