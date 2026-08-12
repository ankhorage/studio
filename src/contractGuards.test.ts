import { isAppManifest as contractsIsAppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { isAppCategory, isAppManifest, isColorHarmony } from './contractGuards';

test('re-exports the canonical Contracts AppManifest guard without wrapping it', () => {
  expect(isAppManifest).toBe(contractsIsAppManifest);
});

test('accepts and rejects manifests according to the Contracts-owned parser', () => {
  const manifest = createManifest();

  expect(isAppManifest(manifest)).toBe(true);
  expect(
    isAppManifest({
      ...manifest,
      themes: [
        {
          ...manifest.themes[0],
          light: { primaryColor: '#2563eb', harmony: 'not-a-harmony' },
        },
      ],
    }),
  ).toBe(false);
});

test('keeps only small Studio input guards backed by owner constants', () => {
  expect(isAppCategory('business_productivity')).toBe(true);
  expect(isAppCategory('not-a-category')).toBe(false);
  expect(isColorHarmony('analogous')).toBe(true);
  expect(isColorHarmony('not-a-harmony')).toBe(false);
});

function createManifest() {
  return {
    metadata: {
      name: 'Release Monitor',
      slug: 'release-monitor',
      version: '1.0.0',
      category: 'business_productivity',
      themeId: 'default',
    },
    themes: [
      {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'default',
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}
