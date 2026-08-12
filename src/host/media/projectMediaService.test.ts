import type { MediaStorageAdapter, StorageUploadInput } from '@ankhorage/contracts/storage';
import { describe, expect, test } from 'bun:test';

import { ProjectManager } from '../orchestrator/projectManager';
import { createAuthoringMediaPath, ProjectMediaService } from './projectMediaService';

function createStorageAdapter(onUpload: (input: StorageUploadInput) => void): MediaStorageAdapter {
  return {
    upload(input) {
      onUpload(input);
      return Promise.resolve({
        ok: true,
        data: { asset: { bucket: input.bucket, path: input.path } },
      });
    },
    remove: () => Promise.resolve({ ok: true }),
    publicUrl: () => Promise.resolve({ ok: true, data: { publicUrl: 'https://example.test/a' } }),
    list: () => Promise.resolve({ ok: true, data: { objects: [] } }),
    resolve(input) {
      return Promise.resolve({
        ok: true,
        data: {
          asset: { ...input, access: input.access ?? 'signed', url: 'https://signed.test/a' },
        },
      });
    },
  };
}

describe('ProjectMediaService', () => {
  test('creates canonical storage assets from trusted bytes', async () => {
    let uploadedPath = '';
    const adapter = createStorageAdapter((input) => {
      uploadedPath = input.path;
    });
    const service = new ProjectMediaService(new ProjectManager('/tmp'), '/tmp', () =>
      Promise.resolve({ adapter, bucket: 'media' }),
    );
    const asset = await service.ingest('demo', {
      assetId: 'Hero Image',
      name: '../Hero Image.png',
      kind: 'image',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      width: 1200,
      height: 800,
    });

    expect(uploadedPath).toBe('authoring/Hero-Image/Hero-Image.png');
    expect(asset).toMatchObject({
      id: 'Hero Image',
      kind: 'image',
      source: { kind: 'storage', bucket: 'media', path: uploadedPath },
      metadata: { originalFileName: '../Hero Image.png', sizeBytes: 3, width: 1200, height: 800 },
    });
  });

  test('resolves only the configured authoring pool', async () => {
    const adapter = createStorageAdapter(() => undefined);
    const service = new ProjectMediaService(new ProjectManager('/tmp'), '/tmp', () =>
      Promise.resolve({ adapter, bucket: 'media' }),
    );

    const resolved = await service.resolve('demo', {
      kind: 'storage',
      bucket: 'media',
      path: 'authoring/hero/a.png',
    });
    expect(resolved).toBe('https://signed.test/a');

    let errorMessage = '';
    try {
      await service.resolve('demo', {
        kind: 'storage',
        bucket: 'private',
        path: 'authoring/hero/a.png',
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).toContain('outside the project authoring pool');
  });

  test('sanitizes authoring object paths', () => {
    expect(createAuthoringMediaPath('../ hero /', '../../my photo.svg')).toBe(
      'authoring/hero/my-photo.svg',
    );
  });
});
