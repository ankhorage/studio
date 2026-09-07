import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  ignore: ['metro.empty-module.js'],
  ignoreDependencies: ['@ankhorage/ankh', 'expo-splash-screen', 'expo-updates'],
  ignoreFiles: [
    '.prettierrc.js',
    'eslint.config.mjs',
    'eslint.local.config.mjs',
    'prettier.local.config.js',
  ],
});
