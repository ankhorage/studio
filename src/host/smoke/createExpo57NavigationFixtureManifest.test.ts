import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { GeneratedAppFileGenerator } from '../layout/layoutGenerator';
import { createExpo57NavigationFixtureManifest } from './createExpo57NavigationFixtureManifest';

const BASE_MANIFEST: AppManifest = {
  metadata: {
    name: 'Base',
    slug: 'base',
    version: '1.0.0',
    category: 'developer_tools',
    themeId: 'default',
  },
  settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  infra: { modules: [] },
  navigator: {
    type: 'stack',
    initialRouteName: 'index',
    routes: [{ name: 'index', screenId: 'index' }],
  },
  screens: {
    index: { id: 'index', name: 'Index', root: { id: 'index-root', type: 'Screen' } },
  },
  themes: [],
  activeThemeId: 'default',
};

describe('Expo 57 generated navigation acceptance fixture', () => {
  test('covers stable Stack, Tabs, Drawer, dynamic and hidden route generation', () => {
    const manifest = createExpo57NavigationFixtureManifest(BASE_MANIFEST, {
      auth: false,
      name: 'Standalone Navigation',
      slug: 'standalone-navigation',
    });
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/navigation', manifest, [], {
      includeStudio: false,
    });
    const source = files.map((file) => file.content).join('\n');
    const paths = files.map((file) => file.path);
    const hiddenTabsLayout = files.find(
      (file) => file.path === 'src/app/hidden-tabs/(tabs)/_layout.tsx',
    )?.content;

    expect(paths).toContain('src/app/(tabs)/_layout.tsx');
    expect(paths).toContain('src/app/(tabs)/profile/[id].tsx');
    expect(paths).toContain('src/app/(tabs)/catalog/_layout.tsx');
    expect(paths).toContain('src/app/hidden-tabs/(tabs)/_layout.tsx');
    expect(paths).toContain('src/app/hidden-tabs/secret.tsx');
    expect(hiddenTabsLayout).toBeDefined();
    expect(hiddenTabsLayout).not.toContain('name="secret"');
    expect(source).toContain("from 'expo-router/js-tabs'");
    expect(source).toContain("from 'expo-router/drawer'");
    expect(source).toContain('<ZoraTabBar {...props} routeMap={routeMap} />');
    expect(source).toContain('<ZoraDrawerContent {...props} routeMap={routeMap} />');
    expect(source).not.toContain('@react-navigation/');
    expect(source).not.toContain('Parameters<typeof Zora');
  });

  test('covers released Studio inclusion and protected auth route groups', () => {
    const manifest = createExpo57NavigationFixtureManifest(BASE_MANIFEST, {
      auth: true,
      name: 'Studio Navigation',
      slug: 'studio-navigation',
    });
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/navigation', manifest, [], {
      includeStudio: true,
    });
    const source = files.map((file) => file.content).join('\n');
    const paths = files.map((file) => file.path);

    expect(paths).toContain('src/app/(app)/(tabs)/profile/[id].tsx');
    expect(paths).toContain('src/app/(auth)/sign-in.tsx');
    expect(source).toContain('name="(app)"');
    expect(source).toContain('name="(auth)"');
    expect(source).toContain('<Stack.Protected');
    expect(source).toContain("from '@ankhorage/studio'");
    expect(source).not.toContain('@react-navigation/');
  });
});
