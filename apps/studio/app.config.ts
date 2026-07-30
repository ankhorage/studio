import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Ankhorage Studio',
  slug: config.slug ?? 'ankhorage-studio',
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.ankhorage.studio',
  },
  plugins: [...(config.plugins ?? [])],
  experiments: {
    ...config.experiments,
    autolinkingModuleResolution: true,
  },
});
