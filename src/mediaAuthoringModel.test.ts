import type { AppManifest, MediaAsset } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  collectStudioMediaAssetUsages,
  createStudioMediaAssetId,
  createStudioMediaAssetReference,
  createStudioUrlMediaAsset,
  listStudioMediaAssets,
  readStudioMediaAssetReference,
  removeStudioMediaAsset,
  upsertStudioMediaAsset,
} from './mediaAuthoringModel';

const imageAsset: MediaAsset = {
  id: 'hero',
  name: 'Hero',
  kind: 'image',
  source: { kind: 'url', url: 'https://example.com/hero.png' },
};

const baseManifest: AppManifest = {
  version: 1,
  app: { id: 'media-test', name: 'Media Test' },
  navigator: { type: 'stack', initialRoute: 'Home', routes: [{ name: 'Home', screenId: 'home' }] },
  screens: {
    home: {
      id: 'home',
      name: 'Home',
      root: {
        id: 'root',
        type: 'Screen',
        children: [
          {
            id: 'image',
            type: 'Image',
            props: { source: { mediaId: 'hero' } },
          },
        ],
      },
    },
  },
};

describe('Studio media authoring model', () => {
  test('lists app-authoring media independently of runtime user storage', () => {
    const manifest = upsertStudioMediaAsset(baseManifest, imageAsset);
    expect(listStudioMediaAssets(manifest)).toEqual([imageAsset]);
    expect(listStudioMediaAssets(manifest, ['audio'])).toEqual([]);
  });

  test('creates exact canonical media references', () => {
    expect(createStudioMediaAssetReference('hero')).toEqual({ mediaId: 'hero' });
    expect(readStudioMediaAssetReference({ mediaId: 'hero' })).toEqual({ mediaId: 'hero' });
    expect(readStudioMediaAssetReference({ mediaId: 'hero', uri: 'blob:preview' })).toBeNull();
  });

  test('creates collision-safe stable media ids', () => {
    expect(createStudioMediaAssetId('Hero image')).toBe('hero-image');
    expect(createStudioMediaAssetId('Hero image', { 'hero-image': imageAsset })).toBe('hero-image-2');
  });

  test('accepts stable HTTP URLs and rejects transient or credential-bearing URLs', () => {
    expect(
      createStudioUrlMediaAsset({ id: 'hero', name: 'Hero', kind: 'image', url: 'https://example.com/a.png' }),
    ).toMatchObject({ ok: true, asset: { source: { kind: 'url' } } });
    for (const url of [
      'blob:https://example.com/preview',
      'file:///tmp/a.png',
      'content://media/1',
      'data:image/png;base64,abc',
      'https://user:secret@example.com/a.png',
    ]) {
      expect(createStudioUrlMediaAsset({ id: 'x', name: 'X', kind: 'image', url })).toEqual({
        ok: false,
        error: 'invalid-url',
      });
    }
  });

  test('finds nested component-property usage before deletion', () => {
    const manifest = upsertStudioMediaAsset(baseManifest, imageAsset);
    expect(collectStudioMediaAssetUsages(manifest, 'hero')).toEqual([
      { screenId: 'home', nodeId: 'image', propertyPath: 'source' },
    ]);
    expect(removeStudioMediaAsset(manifest, 'hero')).toEqual({
      ok: false,
      reason: 'in-use',
      usages: [{ screenId: 'home', nodeId: 'image', propertyPath: 'source' }],
    });
  });

  test('removes unused media and drops the empty media registry', () => {
    const manifest = upsertStudioMediaAsset(
      { ...baseManifest, screens: { home: { ...baseManifest.screens.home, root: { id: 'root', type: 'Screen' } } } },
      imageAsset,
    );
    const result = removeStudioMediaAsset(manifest, 'hero');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.media).toBeUndefined();
  });
});
