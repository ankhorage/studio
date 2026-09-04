import type { ScreenSpec } from '@ankhorage/contracts';

import { escapeStringLiteral } from '../utils/escapeStringLiteral';
import { toSafeComponentName } from './utils/strings';

/*** Generate a runtime-rendered Expo Router screen wrapper for one canonical manifest screen. */
export function getScreenTsx(args: { screenId: string; screenDef: ScreenSpec }) {
  const { screenId, screenDef } = args;
  const safeName = toSafeComponentName(screenDef.name);

  return `import type { AppManifest } from '@ankhorage/contracts';
import {
  ManifestProvider,
  RuntimeRendererConfigProvider,
  RuntimeScreen,
  useOptionalManifestContext,
  useRuntimeRendererConfig,
} from '@ankhorage/runtime';
import { Text, useZoraTheme } from '@ankhorage/zora';
import ankhConfig from '@root/ankh.config.json';
import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

const fallbackManifest = ankhConfig as unknown as AppManifest;
type SearchParams = Record<string, string | string[]>;

function resolveScreenIdParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

function MissingScreen({
  backgroundStyle,
  currentScreenId,
}: {
  backgroundStyle: { backgroundColor: string };
  currentScreenId: string;
}) {
  return (
    <View style={[styles.surface, backgroundStyle]}>
      <View style={styles.missingScreenMessage}>
        <Text align="center" color="danger" variant="bodySmall">
          Screen configuration not found for ID: {currentScreenId}
        </Text>
      </View>
    </View>
  );
}

export default function ${safeName}Screen() {
  const { theme } = useZoraTheme();
  const manifestContext = useOptionalManifestContext();
  const runtimeManifest = manifestContext?.manifest ?? fallbackManifest;
  const runtimeConfig = useRuntimeRendererConfig();
  const local = useLocalSearchParams<SearchParams>();
  const global = useGlobalSearchParams<SearchParams>();
  const routeParams = useMemo(() => ({ ...global, ...local }), [global, local]);

  const currentScreenId =
    resolveScreenIdParam(local.screenId) ??
    resolveScreenIdParam(global.screenId) ??
    '${escapeStringLiteral(screenId)}';
  const screenConfig = Object.values(runtimeManifest.screens).find(
    (candidate) => candidate.id === currentScreenId,
  );
  const backgroundStyle = useMemo(
    () => ({ backgroundColor: theme.colors.background }),
    [theme.colors.background],
  );
  const runtimeRendererConfig = useMemo(
    () => ({
      ...runtimeConfig,
      bindingContext: {
        ...(runtimeConfig.bindingContext ?? {}),
        route: {
          params: routeParams,
        },
      },
    }),
    [routeParams, runtimeConfig],
  );

  if (!screenConfig) {
    return <MissingScreen backgroundStyle={backgroundStyle} currentScreenId={currentScreenId} />;
  }

  return (
    <View style={[styles.surface, backgroundStyle]}>
      <ManifestProvider manifest={runtimeManifest}>
        <RuntimeRendererConfigProvider value={runtimeRendererConfig}>
          <RuntimeScreen
            manifest={runtimeManifest}
            screen={screenConfig}
            stateAdapter={runtimeConfig.stateAdapter}
          />
        </RuntimeRendererConfigProvider>
      </ManifestProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  missingScreenMessage: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  surface: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
});
`;
}
