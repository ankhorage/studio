import { expect, test } from 'bun:test';

import type { AppManifest } from '@ankhorage/contracts';

import { updateStudioScreenMetadata } from './updateStudioScreenMetadata';

test('updates canonical screen metadata while preserving the screen tree', () => {
  const manifest = createManifest();
  const result = updateStudioScreenMetadata(manifest, 'screen-home', {
    id: 'screen-home',
    name: 'Dashboard',
    description: 'Updated metadata',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  const screen = Object.values(result.manifest.screens).find(
    (candidate) => candidate.id === 'screen-home',
  );
  expect(screen).toMatchObject({
    id: 'screen-home',
    name: 'Dashboard',
    description: 'Updated metadata',
    root: manifest.screens['screen-home']?.root,
  });
  expect(screen).not.toHaveProperty('title');
  expect(manifest.screens['screen-home']?.name).toBe('Home');
});

test('rejects metadata that attempts to change stable screen identity', () => {
  const manifest = createManifest();
  const result = updateStudioScreenMetadata(manifest, 'screen-home', {
    id: 'different-screen',
    name: 'Dashboard',
  });

  expect(result).toEqual({ ok: false, manifest });
});

function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'Test',
      slug: 'test',
      version: '1.0.0',
      category: 'other',
      themeId: 'default',
    },
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: {
          primaryColor: '#000000',
          secondaryColor: '#000000',
          tertiaryColor: '#000000',
          quaternaryColor: '#000000',
          backgroundColor: '#ffffff',
          textColor: '#000000',
        },
        dark: {
          primaryColor: '#ffffff',
          secondaryColor: '#ffffff',
          tertiaryColor: '#ffffff',
          quaternaryColor: '#ffffff',
          backgroundColor: '#000000',
          textColor: '#ffffff',
        },
      },
    },
    activeThemeId: 'default',
    infra: { modules: {} },
    navigator: {
      root: {
        type: 'stack',
        routes: [{ name: 'home', screenId: 'screen-home' }],
      },
    },
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Welcome',
        root: { id: 'root', type: 'Box' },
      },
    },
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
  };
}
