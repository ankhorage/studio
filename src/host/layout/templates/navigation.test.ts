import type { AppManifest, NavigatorSpec } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { buildNavigatorJsx } from './navigation';

const manifest = {
  screens: {
    home: { id: 'home', name: 'Home', root: { id: 'home-root', type: 'Screen' } },
    details: { id: 'details', name: 'Details', root: { id: 'details-root', type: 'Screen' } },
  },
} as unknown as AppManifest;

function createNavigator(type: NavigatorSpec['type']): NavigatorSpec {
  return {
    type,
    initialRouteName: 'details',
    routes: [
      { name: 'home', screenId: 'home' },
      {
        name: 'details',
        screenId: 'details',
        showInPrimaryNavigation: false,
        guards: ['authenticated'],
      },
    ],
  };
}

describe('generated primary navigation visibility', () => {
  test('omits hidden Tabs routes from chrome while retaining their route screen', () => {
    const built = buildNavigatorJsx({
      navigator: createNavigator('tabs'),
      manifest,
      includeStudio: false,
    });

    expect(built.jsx).toContain('name="details"');
    expect(built.declarations).toContain('href: null');
    expect(built.declarations).not.toContain("tabBarStyle: { display: 'none' }");
    expect(built.usesZoraTabBar).toBe(false);
  });

  test('omits hidden Drawer routes from chrome without disabling route behavior', () => {
    const built = buildNavigatorJsx({
      navigator: createNavigator('drawer'),
      manifest,
      includeStudio: false,
    });

    expect(built.jsx).toContain('name="details"');
    expect(built.declarations).toContain("drawerItemStyle: { display: 'none' }");
    expect(built.declarations).not.toContain('swipeEnabled: false');
    expect(built.usesZoraDrawerContent).toBe(false);
  });

  test('preserves the visibility field as inert navigation metadata for Stack output', () => {
    const built = buildNavigatorJsx({
      navigator: createNavigator('stack'),
      manifest,
      includeStudio: false,
    });

    expect(built.jsx).toContain('name="details"');
    expect(built.declarations).not.toContain('href: null');
    expect(built.declarations).not.toContain('drawerItemStyle');
  });
});
