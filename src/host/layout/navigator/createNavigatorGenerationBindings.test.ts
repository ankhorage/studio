import type { AppManifest } from '@ankhorage/contracts';
import type { NavigatorNode } from '@ankhorage/contracts/navigator';
import { describe, expect, test } from 'bun:test';

import { createNavigatorGenerationBindings } from './createNavigatorGenerationBindings';

function createManifest(navigator: NavigatorNode): AppManifest {
  return {
    activeThemeId: 'default',
    deploy: { targets: { web: { enabled: true } } },
    infra: { modules: [] },
    media: {
      assets: {
        'train-icon': {
          id: 'train-icon',
          kind: 'image',
          name: 'Train',
          source: { kind: 'bundled', path: 'assets/authoring/train.svg' },
        },
      },
    },
    metadata: {
      category: 'education_learning',
      name: 'Navigator bindings',
      slug: 'navigator-bindings',
      themeId: 'default',
      version: '1.0.0',
    },
    navigator,
    screens: {},
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    themes: [],
  };
}

describe('createNavigatorGenerationBindings', () => {
  test('passes only narrow referenced bindings to Navigator', () => {
    const navigator: NavigatorNode = {
      type: 'tabs',
      implementation: 'native',
      bottomAccessory: { screenId: 'accessory' },
      routes: [
        {
          guards: ['authenticated'],
          icon: { source: { mediaId: 'train-icon' } },
          name: 'train',
          screenId: 'train',
        },
        { name: 'accessory', screenId: 'accessory' },
      ],
    };

    const result = createNavigatorGenerationBindings({
      authEnabled: true,
      manifest: createManifest(navigator),
      roots: [{ navigator, rootDirectory: 'src/app/(app)' }],
    });

    expect(result.bindings.screens).toEqual({
      accessory: {
        exportName: 'NavigatorScreen0',
        module: '@/generated/navigatorScreenBindings',
      },
    });
    expect(result.bindings.screens).not.toHaveProperty('train');
    expect(result.bindings.guards.authenticated).toEqual({
      exportName: 'isInOwnedAuthRouteGroup',
      module: '@/generated/navigatorGuardBindings',
    });
    expect(
      result.files.find(({ path }) => path.endsWith('navigatorIconBindings.ts'))?.content,
    ).toContain("case 'train-icon':");
    expect(
      result.files.find(({ path }) => path.endsWith('navigatorIconBindings.ts'))?.content,
    ).toContain("return requireBundledNavigatorIconSource('assets/authoring/train.svg');");
    expect(result.files.map(({ path }) => path)).toEqual([
      'src/generated/navigatorScreenBindings.ts',
      'src/generated/navigatorGuardBindings.ts',
      'src/generated/navigatorIconBindings.ts',
    ]);
  });

  test('rejects asynchronous storage icons at the generation boundary', () => {
    const navigator: NavigatorNode = {
      type: 'tabs',
      implementation: 'headless',
      presentation: 'bottom',
      routes: [
        { name: 'home', path: '/', icon: { source: { mediaId: 'stored-icon' } }, screenId: 'home' },
      ],
    };
    const manifest = createManifest(navigator);
    manifest.media = {
      assets: {
        'stored-icon': {
          id: 'stored-icon',
          kind: 'image',
          name: 'Stored',
          source: { bucket: 'media', kind: 'storage', path: 'icons/stored.svg' },
        },
      },
    };

    expect(() =>
      createNavigatorGenerationBindings({
        authEnabled: false,
        manifest,
        roots: [{ navigator, rootDirectory: 'src/app/(app)' }],
      }),
    ).toThrow('requires asynchronous storage resolution');
  });
});
