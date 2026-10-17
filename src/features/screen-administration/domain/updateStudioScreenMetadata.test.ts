import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

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

  expect(result.manifest.screens['screen-home']).toEqual({
    id: 'screen-home',
    name: 'Dashboard',
    description: 'Updated metadata',
    root: { id: 'root', type: 'Box' },
  });
  expect(manifest.screens['screen-home']?.name).toBe('Home');
  expect(manifest.screens['screen-home']?.title).toBe('Welcome');
});

test('rejects metadata that attempts to change stable screen identity', () => {
  const manifest = createManifest();
  const result = updateStudioScreenMetadata(manifest, 'screen-home', {
    id: 'different-screen',
    name: 'Dashboard',
  });

  expect(result).toEqual({ ok: false, manifest });
});

function createManifest(): Pick<AppManifest, 'screens'> {
  return {
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Welcome',
        root: { id: 'root', type: 'Box' },
      },
    },
  };
}
