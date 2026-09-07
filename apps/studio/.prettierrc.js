const sharedConfig = require('@ankhorage/devtools/prettier');
const localConfig = require('./prettier.local.config.js');

module.exports = {
  ...sharedConfig,
  ...localConfig,
  overrides: [...(sharedConfig.overrides ?? []), ...(localConfig.overrides ?? [])],
};
