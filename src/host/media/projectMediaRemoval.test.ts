import type { MediaStorageAdapter, StorageRemoveInput } from '@ankhorage/contracts/storage';
import { expect, test } from 'bun:test';

import { ProjectManager } from '../orchestrator/projectManager';
import { ProjectMediaService } from './projectMediaService';

test('managed media cleanup stays inside the configured authoring pool', async () => {
  const removed: StorageRemoveInput[] = [];
  const adapter = createStorageAdapter((input) => removed.push(input));
  const service = new ProjectMediaService(new ProjectManager('/tmp'), '/tmp', () =>
    Promise.resolve({ adapter, bucket: 'media' }),
  );

  await service.remove('demo', {
    kind: 'storage',
    storageId: 'primary',
    bucket: 'media',
    path: 'authoring/hero/a.png',
  });
  expect(removed[0]).toMatchObject({
    storageId: 'primary',
    bucket: 'media',
    path: 'authoring/hero/a.png',
  });

  await expect(
    service.remove('demo', { kind: 'storage', bucket: 'media', path: 'runtime/avatar.png' }),
  ).rejects.toThrow('outside the project authoring pool');
  expect(removed).toHaveLength(1);
});

function createStorageAdapter(onRemove: (input: StorageRemoveInput) => void): MediaStorageAdapter {
  return {
    upload: (input) =>
      Promise.resolve({ ok: true, data: { asset: { bucket: input.bucket, path: input.path } } }),
    remove(input) {
      onRemove(input);
      return Promise.resolve({ ok: true });
    },
    publicUrl: () => Promise.resolve({ ok: true, data: { publicUrl: 'https://example.test/a' } }),
    list: () => Promise.resolve({ ok: true, data: { objects: [] } }),
    resolve: (input) =>
      Promise.resolve({
        ok: true,
        data: {
          asset: { ...input, access: input.access ?? 'signed', url: 'https://signed.test/a' },
        },
      }),
  };
}
