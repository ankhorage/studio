import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { getRootLayoutTsx } from './rootLayout';

test('keeps the Studio selection Pressable non-semantic on web', () => {
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
    includeStudio: true,
  });

  expect(generated).toContain('<Pressable');
  expect(generated).not.toContain('accessibilityRole="button"');
  expect(generated).toContain('accessibilityState={{ selected }}');
  expect(generated).toContain('disableActions: !previewMode');
  expect(generated).toContain('if (previewMode || !props.nodeId)');
  expect(generated).toContain('selectNode(props.nodeId ?? null);');
});
