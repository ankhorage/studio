import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Ankhorage Studio',
  slug: config.slug ?? 'ankhorage-studio',
  plugins: [...(config.plugins ?? [])],
});
