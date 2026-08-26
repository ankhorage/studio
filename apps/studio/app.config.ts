import type { ConfigContext, ExpoConfig } from 'expo/config';

const STATIC_ICON_PLUGINS = [
  '@react-native-vector-icons/fontawesome',
  '@react-native-vector-icons/fontawesome5',
  '@react-native-vector-icons/fontawesome6',
  '@react-native-vector-icons/ionicons',
] as const;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Ankhorage Studio',
  slug: config.slug ?? 'ankhorage-studio',
  scheme: config.scheme ?? 'ankhorage-studio',
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.ankhorage.studio',
  },
  ios: {
    ...config.ios,
    bundleIdentifier: config.ios?.bundleIdentifier ?? 'com.ankhorage.studio',
  },
  web: {
    ...config.web,
    output: 'static',
  },
  plugins: ['expo-router', ...STATIC_ICON_PLUGINS, ...(config.plugins ?? [])],
  experiments: {
    ...config.experiments,
    reactCompiler: true,
    typedRoutes: true,
  },
});
