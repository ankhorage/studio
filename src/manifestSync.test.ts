import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from './index';
import {
  createStudioManifestSignature,
  createStudioRuntimeSyncSignature,
} from './manifestSync';

function createManifest(overrides: Partial<StudioManifest> = {}): StudioManifest {
  return {
    navigator: {
      type: 'tabs',
      routes: [{ name: 'home', screenId: 'screen-home' }],
    },
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Home',
        root: {
          id: 'root-home',
          type: 'Screen',
          props: { changedOnlyInAuthoring: false },
        },
      },
    },
    data: {},
    dataBindings: {},
    dataSources: {},
    themes: [],
    activeThemeId: '',
    activeThemeMode: 'light',
    settings: {
      localization: { defaultLocale: 'en', locales: ['en'] },
    },
    infra: {
      modulesConfig: {},
      plugins: ['expo-camera', 'expo-localization'],
    },
    ...overrides,
  } as unknown as StudioManifest;
}

describe('manifestSync', () => {
  test('creates full Studio manifest signatures for draft persistence', () => {
    const first = createManifest();
    const second = createManifest({
      screens: {
        'screen-home': {
          ...first.screens['screen-home'],
          root: {
            ...first.screens['screen-home'].root,
            props: { changedOnlyInAuthoring: true },
          },
        },
      },
    });

    expect(createStudioManifestSignature(first)).not.toBe(createStudioManifestSignature(second));
  });

  test('creates runtime signatures from runtime-relevant manifest fields', () => {
    const first = createManifest();
    const second = createManifest({
      screens: {
        'screen-home': {
          ...first.screens['screen-home'],
          root: {
            ...first.screens['screen-home'].root,
            props: { changedOnlyInAuthoring: true },
          },
        },
      },
    });

    expect(createStudioRuntimeSyncSignature(first)).toBe(createStudioRuntimeSyncSignature(second));
  });

  test('normalizes plugin order in runtime signatures', () => {
    const first = createManifest({ infra: { modulesConfig: {}, plugins: ['b', 'a'] } as never });
    const second = createManifest({ infra: { modulesConfig: {}, plugins: ['a', 'b'] } as never });

    expect(createStudioRuntimeSyncSignature(first)).toBe(createStudioRuntimeSyncSignature(second));
  });
});
