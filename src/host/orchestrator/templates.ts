import type { SplashScreenSpec } from '@ankhorage/contracts';
import {
  type ExpoRuntimeConfigPluginOutput,
  type ExpoRuntimePlan,
  resolveExpoRuntimeDependencyMap,
  resolveExpoRuntimeNativeOutput,
} from '@ankhorage/expo-runtime/planning';

export type GeneratedAuthProvider = 'supabase' | null;
export type GeneratedStorageProvider = 'supabase' | null;
const EXPO_MODULES_CORE_VERSION = '~3.0.30';
const CONTRACTS_VERSION = '^4.0.0';
const SUPABASE_AUTH_VERSION = '^1.0.0';
const EXPO_SECURE_STORE_VERSION = '~15.0.8';
const EXPO_WEB_BROWSER_VERSION = '~15.0.11';

const RESERVED_NATIVE_IDENTIFIER_SEGMENTS = new Set(
  [
    'abstract',
    'annotation',
    'as',
    'break',
    'byte',
    'case',
    'catch',
    'char',
    'class',
    'companion',
    'const',
    'continue',
    'data',
    'do',
    'double',
    'else',
    'enum',
    'extends',
    'false',
    'final',
    'finally',
    'float',
    'for',
    'fun',
    'if',
    'implements',
    'import',
    'in',
    'int',
    'interface',
    'internal',
    'is',
    'long',
    'native',
    'new',
    'null',
    'object',
    'open',
    'operator',
    'out',
    'override',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'sealed',
    'short',
    'static',
    'strictfp',
    'super',
    'suspend',
    'switch',
    'synchronized',
    'this',
    'throw',
    'throws',
    'transient',
    'true',
    'try',
    'typealias',
    'typeof',
    'val',
    'var',
    'void',
    'volatile',
    'when',
    'while',
  ].map((segment) => segment.toLowerCase()),
);

function serializeStringLiteral(value: string): string {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')}'`;
}

function serializeJsValue(value: unknown, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (
      value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry)) &&
      value.length <= 3
    ) {
      return `[${value.map((entry) => serializeJsValue(entry)).join(', ')}]`;
    }

    return `[\n${value
      .map((entry) => `${nextIndent}${serializeJsValue(entry, indentLevel + 1)}`)
      .join(',\n')}\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(([key, entryValue]) => {
        const serializedKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? key : JSON.stringify(key);
        return `${nextIndent}${serializedKey}: ${serializeJsValue(entryValue, indentLevel + 1)}`;
      })
      .join(',\n')},\n${indent}}`;
  }

  if (typeof value === 'string') {
    return serializeStringLiteral(value);
  }

  return String(value);
}

function serializeSplashScreenPlugin(
  splashScreen: SplashScreenSpec | null | undefined,
): string | null {
  if (splashScreen == null) {
    return null;
  }

  const serializedConfig = serializeJsValue(splashScreen, 3);
  return `[
      'expo-splash-screen',
      ${serializedConfig},
    ]`;
}

function serializeRuntimePlugin(plugin: ExpoRuntimeConfigPluginOutput): string {
  if (typeof plugin === 'string') {
    return serializeJsValue(plugin);
  }

  const [name, options] = plugin;
  const serializedOptions = serializeJsValue(options, 3);
  return `[
      ${serializeJsValue(name)},
      ${serializedOptions},
    ]`;
}

function serializePluginsWithRuntimePlan(args: {
  splashScreen: SplashScreenSpec | null | undefined;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const entries = resolveExpoRuntimeNativeOutput(args.runtimePlan).configPlugins.map(
    serializeRuntimePlugin,
  );
  const splashPlugin = serializeSplashScreenPlugin(args.splashScreen);
  if (splashPlugin !== null) {
    entries.push(splashPlugin);
  }

  if (entries.length === 0) {
    return '[...(config.plugins ?? [])]';
  }

  return `[
    ...(config.plugins ?? []),
    ${entries.join(',\n    ')},
  ]`;
}

function createNativeIdentifierSegment(bundleSuffix: string): string {
  const sanitized = bundleSuffix.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  const ensuredValue = sanitized.length > 0 ? sanitized : 'app';
  const leadingLetterSegment = /^[a-z]/u.test(ensuredValue) ? ensuredValue : `app${ensuredValue}`;

  return RESERVED_NATIVE_IDENTIFIER_SEGMENTS.has(leadingLetterSegment)
    ? `app${leadingLetterSegment}`
    : leadingLetterSegment;
}

function createNativeApplicationId(bundleSuffix: string): string {
  return `com.ankh.${createNativeIdentifierSegment(bundleSuffix)}`;
}

function createExpoScheme(bundleSuffix: string): string {
  const identitySegment = createNativeIdentifierSegment(bundleSuffix).replaceAll('_', '') || 'app';
  return `ankh-${identitySegment}`;
}

function serializeAndroidConfig(args: {
  bundleSuffix: string;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const permissions = resolveExpoRuntimeNativeOutput(args.runtimePlan).androidPermissions;
  const extraLines =
    permissions.length > 0 ? `\n    permissions: ${serializeJsValue(permissions, 2)},` : '';

  return `{
    ...config.android,${extraLines}
    package: ${serializeStringLiteral(createNativeApplicationId(args.bundleSuffix))},
  }`;
}

export function getAppConfigTs({
  name,
  slug,
  bundleSuffix,
  splashScreen = null,
  runtimePlan,
}: {
  name: string;
  slug: string;
  bundleSuffix: string;
  splashScreen?: SplashScreenSpec | null;
  runtimePlan?: ExpoRuntimePlan;
}) {
  const appConfigTs = `import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: ${serializeStringLiteral(name)},
  slug: ${serializeStringLiteral(slug)},
  scheme: ${serializeStringLiteral(createExpoScheme(bundleSuffix))},
  plugins: ${serializePluginsWithRuntimePlan({ splashScreen, runtimePlan })},
  android: ${serializeAndroidConfig({ bundleSuffix, runtimePlan })},
  ios: {
    ...config.ios,
    bundleIdentifier: ${serializeStringLiteral(createNativeApplicationId(bundleSuffix))},
  },
  web: {
    ...config.web,
    output: 'static',
    favicon: './assets/favicon.png',
  },
});
`;
  return appConfigTs;
}

export function getMetroConfigJs() {
  const metroConfigJs = `const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
`;
  return metroConfigJs;
}

export function getBabelConfigJs() {
  return `module.exports = function (api) {
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
      'react-native-reanimated/plugin',
    ],
  };
};
`;
}

export function getPackageJson(args: {
  name: string;
  includeStudio?: boolean;
  authProvider?: GeneratedAuthProvider;
  storageProvider?: GeneratedStorageProvider;
  runtimePlan?: ExpoRuntimePlan;
}) {
  const {
    name,
    includeStudio = false,
    authProvider = null,
    storageProvider = null,
    runtimePlan,
  } = args;
  const runtimeDependencies = resolveExpoRuntimeDependencyMap(runtimePlan);
  const pkgJson = {
    name,
    main: 'index.js',
    packageManager: 'bun@1.3.13',
    version: '1.0.0',
    scripts: {
      start: 'expo start',
      android: 'expo run:android',
      ios: 'expo run:ios',
      web: 'expo start --web',
      lint: 'ankhorage-eslint . --max-warnings=0',
      'lint:fix': 'ankhorage-eslint . --fix --max-warnings=0',
      format: 'ankhorage-prettier --write .',
      'format:check': 'ankhorage-prettier --check .',
    },
    dependencies: {
      '@ankhorage/contracts': CONTRACTS_VERSION,
      '@ankhorage/data-sources': 'latest',
      '@ankhorage/runtime': '^0.2.0',
      '@ankhorage/studio': 'latest',
      ...(authProvider === 'supabase'
        ? {
            '@ankhorage/supabase-auth': SUPABASE_AUTH_VERSION,
            'expo-secure-store': EXPO_SECURE_STORE_VERSION,
            'expo-web-browser': EXPO_WEB_BROWSER_VERSION,
          }
        : {}),
      ...(storageProvider === 'supabase' ? { '@ankhorage/supabase-storage': 'latest' } : {}),
      '@ankhorage/zora': 'latest',
      ...runtimeDependencies,
      ...(includeStudio
        ? {
            '@expo/vector-icons': '^15.0.3',
            '@react-native-picker/picker': '2.11.1',
          }
        : {}),
      '@react-navigation/bottom-tabs': '^7.18.2',
      '@react-navigation/drawer': '^7.5.0',
      'babel-preset-expo': '^54.0.10',
      expo: '~54.0.35',
      'expo-constants': '~18.0.13',
      'expo-font': '~14.0.12',
      'expo-linear-gradient': '~15.0.8',
      'expo-linking': '~8.0.12',
      'expo-modules-core': EXPO_MODULES_CORE_VERSION,
      'expo-router': '~6.0.24',
      'expo-splash-screen': '~31.0.10',
      'expo-status-bar': '^3.0.9',
      'expo-updates': '~29.0.18',
      react: '19.1.0',
      'react-dom': '19.1.0',
      'react-native': '0.81.5',
      'react-native-gesture-handler': '~2.28.0',
      'react-native-reanimated': '~4.1.1',
      'react-native-safe-area-context': '~5.6.0',
      'react-native-screens': '~4.16.0',
      'react-native-svg': '~15.12.1',
      'react-native-web': '^0.21.2',
      'react-native-worklets': '0.5.1',
      'reanimated-color-picker': '^4.2.0',
    },
    devDependencies: {
      '@ankhorage/devtools': '^1.0.6',
      '@types/node': '^25.6.0',
      '@types/react': '~19.1.0',
      '@types/culori': '^4.0.1',
      'babel-plugin-module-resolver': '^5.0.0',
      typescript: '~5.9.2',
    },
  };

  return pkgJson;
}

export function getEslintConfigMjs() {
  return `import { createConfig } from '@ankhorage/devtools/eslint';

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.json'],
  files: [
    'app.config.ts',
    'src/app/**/*.{ts,tsx}',
    'src/auth/**/*.{ts,tsx}',
    'src/generated/**/*.{ts,tsx}',
    'src/modules/**/*.{ts,tsx}',
  ],
  additionalIgnores: [
    '**/*.js',
    '**/*.cjs',
    '**/*.mjs',
    'dist/**',
    '.expo/**',
  ],
});
`;
}

export function getPrettierRcJs() {
  return `module.exports = require('@ankhorage/devtools/prettier');
`;
}

export function getIndexJs() {
  return `import React from 'react';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

function App() {
  const ctx = require.context('./src/app');

  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
`;
}

export function getTsConfigJson() {
  const tsConfigJson = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-native",
    "outDir": "dist",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["node"],
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@root/*": ["./*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
`;
  return tsConfigJson;
}
