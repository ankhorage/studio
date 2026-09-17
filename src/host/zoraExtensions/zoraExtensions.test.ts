import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import { getGeneratedPackagePolicy } from '../../features/project-updates/adapters/outbound/getGeneratedPackagePolicy';
import {
  resolveZoraExtensionsForManifest,
  resolveZoraExtensionsFromDependencies,
} from './index';

describe('ZORA extension owner discovery', () => {
  it('derives Tabletop component ownership from the installed plugin descriptor', () => {
    const [extension] = resolveZoraExtensionsForManifest(createManifest(['PokerTrainingTable']));

    expect(extension?.packageName).toBe('@ankhorage/zora-tabletop');
    expect(extension?.descriptorExportName).toBe('ZORA_TABLETOP_PLUGIN');
    expect(extension?.componentTypes).toContain('PokerTrainingTable');
    expect(extension?.componentTypes).toContain('TabletopTable');
    expect(extension?.dependencies).toEqual({
      '@ankhorage/zora-tabletop': readExtensionRange('@ankhorage/zora-tabletop'),
    });
  });

  it('resolves mixed manifests without duplicating plugin-owned component inventories', () => {
    const extensions = resolveZoraExtensionsForManifest(
      createManifest(['ChessBoard', 'PokerTrainingTable']),
    );

    expect(extensions.map(({ packageName }) => packageName)).toEqual([
      '@ankhorage/zora-chess',
      '@ankhorage/zora-tabletop',
    ]);
    expect(extensions[0]?.componentTypes).toEqual(['ChessBoard', 'OpeningBook']);
    expect(extensions[1]?.componentTypes).toContain('PokerTrainingTable');
  });

  it('reuses Studio package policy when preserving an existing generated extension', () => {
    const [extension] = resolveZoraExtensionsFromDependencies({
      '@ankhorage/zora-tabletop': '^0.0.1',
    });

    expect(extension?.dependencies).toEqual({
      '@ankhorage/zora-tabletop': readExtensionRange('@ankhorage/zora-tabletop'),
    });
  });
});

function createManifest(componentTypes: readonly string[]): AppManifest {
  return {
    metadata: {
      name: 'ZORA extension fixture',
      slug: 'zora-extension-fixture',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
        },
      },
      modules: [],
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: {
          id: 'root',
          type: 'Page',
          children: componentTypes.map((type, index) => ({
            id: `component-${index}`,
            type,
          })),
        },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

function readExtensionRange(packageName: string): string {
  const range = Object.entries(getGeneratedPackagePolicy().dependencies.zoraExtensions).find(
    ([name]) => name === packageName,
  )?.[1];
  if (range === undefined) {
    throw new Error(`Missing generated package policy for ${packageName}.`);
  }
  return range;
}
