import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { updateStudioScreenRequirements } from './updateStudioScreenRequirements';

test('updates explicit screen requirements while preserving every unrelated screen field', () => {
  const manifest = createManifest();
  const result = updateStudioScreenRequirements(manifest, 'screen-home', {
    permissions: { camera: true },
    capabilities: { mediaPicker: true },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.manifest.screens['screen-home']).toEqual({
    id: 'screen-home',
    name: 'Home',
    title: 'Welcome',
    root: { id: 'root', type: 'CameraPreview' },
    dataLoaders: [],
    requires: {
      permissions: { camera: true },
      capabilities: { mediaPicker: true },
    },
  });
  expect(manifest.screens['screen-home']?.requires).toEqual({
    permissions: { microphone: true },
  });
});

test('removes empty explicit requirements instead of persisting empty set shells', () => {
  const manifest = createManifest();
  const result = updateStudioScreenRequirements(manifest, 'screen-home', {
    permissions: {},
    capabilities: {},
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.manifest.screens['screen-home']?.requires).toBeUndefined();
});

test('rejects missing or mismatched stable screen registry identity', () => {
  const manifest = createManifest();

  expect(updateStudioScreenRequirements(manifest, 'missing', undefined)).toEqual({
    ok: false,
    manifest,
  });

  const screen = manifest.screens['screen-home'];
  expect(screen).toBeDefined();
  if (!screen) throw new Error('Expected screen fixture.');

  const mismatched = {
    screens: {
      'screen-home': {
        ...screen,
        id: 'different-screen',
      },
    },
  };
  expect(updateStudioScreenRequirements(mismatched, 'screen-home', undefined)).toEqual({
    ok: false,
    manifest: mismatched,
  });
});

function createManifest(): Pick<AppManifest, 'screens'> {
  return {
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Welcome',
        root: { id: 'root', type: 'CameraPreview' },
        dataLoaders: [],
        requires: { permissions: { microphone: true } },
      },
    },
  };
}
