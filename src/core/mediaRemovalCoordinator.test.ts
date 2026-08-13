import type { AppManifest, MediaAssetSource } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { commitStudioMediaRemoval } from './mediaRemovalCoordinator';

const manifest = {
  navigator: { initialRouteName: 'index', routes: [] },
  screens: {},
  media: {
    assets: {
      hero: {
        id: 'hero',
        name: 'Hero',
        kind: 'image',
        source: { kind: 'bundled', path: 'assets/authoring/hero/hero.png' },
      },
    },
  },
} as unknown as AppManifest;

describe('commitStudioMediaRemoval', () => {
  test('persists the manifest removal before cleaning up the physical source', async () => {
    const calls: string[] = [];
    const result = await commitStudioMediaRemoval({
      manifest,
      mediaId: 'hero',
      applyManifest: () => calls.push('apply'),
      persistManifest: () => {
        calls.push('persist');
        return Promise.resolve();
      },
      cleanupSource: (_source: MediaAssetSource) => {
        calls.push('cleanup');
        return Promise.resolve({ ok: true, cleanup: 'removed' });
      },
    });

    expect(result).toEqual({ ok: true, cleanup: 'removed' });
    expect(calls).toEqual(['apply', 'persist', 'cleanup']);
  });

  test('rolls back locally and never cleans up when manifest persistence fails', async () => {
    const calls: string[] = [];
    const result = await commitStudioMediaRemoval({
      manifest,
      mediaId: 'hero',
      applyManifest: () => calls.push('apply'),
      persistManifest: () => {
        calls.push('persist');
        return Promise.reject(new Error('save failed'));
      },
      cleanupSource: () => {
        calls.push('cleanup');
        return Promise.resolve({ ok: true, cleanup: 'removed' });
      },
    });

    expect(result).toEqual({
      ok: false,
      reason: 'save-failed',
      message: 'save failed',
      mediaRemoved: false,
    });
    expect(calls).toEqual(['apply', 'persist', 'apply']);
  });

  test('reports an orphan without restoring a manifest reference after cleanup failure', async () => {
    const applied: AppManifest[] = [];
    const result = await commitStudioMediaRemoval({
      manifest,
      mediaId: 'hero',
      applyManifest: (value) => applied.push(value),
      persistManifest: () => Promise.resolve(),
      cleanupSource: () => Promise.resolve({ ok: false, reason: 'provider unavailable' }),
    });

    expect(result).toEqual({
      ok: false,
      reason: 'cleanup-failed',
      message: 'provider unavailable',
      mediaRemoved: true,
    });
    expect(applied).toHaveLength(1);
    expect(applied[0]?.media?.assets.hero).toBeUndefined();
  });
});
