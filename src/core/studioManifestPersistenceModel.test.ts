import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from '../index';
import { createStudioManifestSignature } from '../manifestSync';
import { StudioManifestPersistenceCoordinator } from './studioManifestPersistenceModel';

function createManifest(name: string): StudioManifest {
  return {
    metadata: {
      name,
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'theme-1',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [
      {
        id: 'theme-1',
        name: 'Theme',
        light: { primaryColor: '#111111', harmony: 'monochromatic' },
        dark: { primaryColor: '#222222', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'theme-1',
    activeThemeMode: 'light',
  };
}

function createDeferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
} {
  let resolvePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => {
      resolvePromise?.();
    },
  };
}

describe('StudioManifestPersistenceCoordinator', () => {
  test('serializes writes and persists newer manifest state after an older in-flight save', async () => {
    let currentManifest = createManifest('M1');
    let lastPersistedSignature = createStudioManifestSignature(createManifest('M0'));
    const saves: string[] = [];
    const firstSave = createDeferred();
    const firstSaveStarted = createDeferred();

    const coordinator = new StudioManifestPersistenceCoordinator({
      projectId: 'demo',
      readManifest: () => currentManifest,
      readLastPersistedSignature: () => lastPersistedSignature,
      setLastPersistedSignature: (signature) => {
        lastPersistedSignature = signature ?? '';
      },
      saveManifest: async (_projectId, manifest) => {
        saves.push(manifest.metadata.name);
        if (saves.length === 1) {
          firstSaveStarted.resolve();
          await firstSave.promise;
        }
      },
      setSaveStatus: () => undefined,
      setError: () => undefined,
      toErrorMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    const queued = coordinator.queueLatestSave();
    await firstSaveStarted.promise;
    currentManifest = createManifest('M2');
    const flushed = coordinator.flushLatestSave();

    firstSave.resolve();
    await queued;
    await flushed;

    expect(saves).toEqual(['M1', 'M2']);
    expect(lastPersistedSignature).toBe(createStudioManifestSignature(currentManifest));
  });

  test('flush rejects and keeps latest manifest eligible for retry after persistence failure', async () => {
    const currentManifest = createManifest('M1');
    let lastPersistedSignature = createStudioManifestSignature(createManifest('M0'));
    let shouldFail = true;
    const statuses: string[] = [];

    const coordinator = new StudioManifestPersistenceCoordinator({
      projectId: 'demo',
      readManifest: () => currentManifest,
      readLastPersistedSignature: () => lastPersistedSignature,
      setLastPersistedSignature: (signature) => {
        lastPersistedSignature = signature ?? '';
      },
      saveManifest: () => {
        if (shouldFail) return Promise.reject(new Error('disk full'));
        return Promise.resolve();
      },
      setSaveStatus: (status) => statuses.push(status),
      setError: () => undefined,
      toErrorMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    try {
      await coordinator.flushLatestSave();
      throw new Error('Expected flush to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof Error ? error.message : '').toBe('disk full');
    }
    expect(lastPersistedSignature).not.toBe(createStudioManifestSignature(currentManifest));

    shouldFail = false;
    await coordinator.flushLatestSave();

    expect(lastPersistedSignature).toBe(createStudioManifestSignature(currentManifest));
    expect(statuses).toEqual(['saving', 'error', 'saving', 'saved']);
  });
});
