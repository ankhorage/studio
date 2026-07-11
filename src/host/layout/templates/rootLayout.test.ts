import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { getRootLayoutTsx } from './rootLayout';

test('declares generated runtime registries before composing them', () => {
  const generated = getRootLayoutTsx({
    manifest: {
      navigator: {
        initialRouteName: 'index',
      },
    } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: {
      declarations: '',
      jsx: '<></>',
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    },
    includeStudio: false,
    runtimeModuleDeclarations: `const APP_EXTENSION_COMPONENT_REGISTRY = {};
const ZORA_COMPONENT_REGISTRY = {};`,
  });

  const registryDeclarationIndex = generated.indexOf('const ZORA_COMPONENT_REGISTRY = {};');
  const registryCompositionIndex = generated.indexOf('const runtimeComponentRegistry = {');

  expect(registryDeclarationIndex).toBeGreaterThanOrEqual(0);
  expect(registryCompositionIndex).toBeGreaterThan(registryDeclarationIndex);
});
