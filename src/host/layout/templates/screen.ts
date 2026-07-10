import type { ScreenSpec } from '@ankhorage/contracts';

import { escapeStringLiteral } from '../utils/escapeStringLiteral';
import { toSafeComponentName } from './utils/strings';

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
import { ScrollView, View } from 'react-native';

const fallbackManifest = ankhConfig as unknown as AppManifest;
type SearchParams = Record<string, string | string[] | undefined> & {
  screenId?: string | string[];
};

function resolveScreenIdParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
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
  const screenConfig = runtimeManifest.screens[currentScreenId];
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
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
          <Text align="center" color="danger" variant="bodySmall">
            Screen configuration not found for ID: {currentScreenId}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <ManifestProvider manifest={runtimeManifest}>
          <RuntimeRendererConfigProvider value={runtimeRendererConfig}>
            <RuntimeScreen
              manifest={runtimeManifest}
              screen={screenConfig}
              stateAdapter={runtimeConfig.stateAdapter}
            />
          </RuntimeRendererConfigProvider>
        </ManifestProvider>
      </ScrollView>
    </View>
  );
}
`;
}
