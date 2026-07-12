import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { LayoutGenerator } from './layoutGenerator';

function createManifest(): AppManifest {
  return {
    metadata: { name: 'Demo', slug: 'demo', version: '1.0.0', themeId: 'default' },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [] },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: { id: 'root', type: 'Page' },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

describe('LayoutGenerator', () => {
  test('generates canonical Studio admin route anchors', () => {
    const files = new LayoutGenerator().generateAll('/tmp/demo', createManifest(), []);
    const paths = files.map((file) => file.path).sort();

    expect(paths).toContain('src/app/ankh/_layout.tsx');
    expect(paths).toContain('src/app/ankh/apis.tsx');
    expect(paths).toContain('src/app/ankh/auth.tsx');
    expect(paths).toContain('src/app/ankh/secrets.tsx');
    expect(paths).toContain('src/app/ankh/properties/[id].tsx');
    expect(paths).toContain('src/app/ankh/theme.tsx');
  });
});
