import type { NavigatorNode } from '@ankhorage/contracts/navigator';
import { describe, expect, test } from 'bun:test';

import { generateNavigatorLayoutFiles } from './generateNavigatorLayoutFiles';

const bindings = { guards: {}, screens: {} } as const;

describe('generateNavigatorLayoutFiles', () => {
  test('hides an unlabeled route-group Stack header that owns a nested navigator', () => {
    const files = generateNavigatorLayoutFiles({
      bindings,
      navigator: {
        type: 'stack',
        routes: [
          {
            name: '(tabs)',
            navigator: {
              type: 'tabs',
              implementation: 'headless',
              presentation: 'bottom',
              routes: [{ name: 'train', path: '/train', screenId: 'train' }],
            },
          },
        ],
      },
      rootDirectory: 'src/app/(app)',
      targets: { web: { enabled: true } },
    });

    const layout = files.find(({ path }) => path.endsWith('/_layout.tsx'))?.content;
    expect(layout).toContain('name="(tabs)"');
    expect(layout).toContain('headerShown: false');
  });

  test('generates released Navigator layouts below the Studio-owned app shell', () => {
    const navigator: NavigatorNode = {
      type: 'tabs',
      initialRouteName: 'train',
      routes: [
        { name: 'train', path: '/train', label: 'Train', screenId: 'train' },
        { name: 'contact', path: '/contact', label: 'Contact', screenId: 'contact' },
      ],
    };

    const files = generateNavigatorLayoutFiles({
      bindings,
      navigator,
      rootDirectory: 'src/app/(app)',
      targets: {
        android: { enabled: true, package: 'com.ankhorage.navigator' },
        ios: { bundleIdentifier: 'com.ankhorage.navigator', enabled: true },
        web: { enabled: true },
      },
    });

    expect(files.map(({ path }) => path)).toEqual([
      'src/app/(app)/_layout.android.tsx',
      'src/app/(app)/_layout.ios.tsx',
      'src/app/(app)/_layout.tsx',
    ]);
    expect(files.find(({ path }) => path.endsWith('/_layout.tsx'))?.content).toContain(
      "href: '/train'",
    );
    expect(files.find(({ path }) => path.endsWith('/_layout.ios.tsx'))?.content).toContain(
      'expo-router/unstable-native-tabs',
    );
  });

  test('surfaces unsupported owner diagnostics before writing layout files', () => {
    expect(() =>
      generateNavigatorLayoutFiles({
        bindings,
        navigator: {
          type: 'tabs',
          implementation: 'native',
          routes: [
            { name: 'home', screenId: 'home' },
            { name: 'hidden', screenId: 'hidden', showInPrimaryNavigation: false },
          ],
        },
        rootDirectory: 'src/app/(app)',
        targets: { ios: { bundleIdentifier: 'com.ankhorage.navigator', enabled: true } },
      }),
    ).toThrow('native-tabs-hidden-route');
  });
});
