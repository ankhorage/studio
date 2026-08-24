import type { ExpoMediaPickerAdapter } from '@ankhorage/expo-runtime/media-picker';
import { describe, expect, it } from 'bun:test';

import { pickProjectDeployImage } from './projectDeployAssetPicker';

describe('pickProjectDeployImage', () => {
  it('uses the shared Expo media adapter for an image file selection', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const mediaPicker: ExpoMediaPickerAdapter = {
      pick: (input) => {
        expect(input).toEqual({ source: 'file', mediaKinds: ['image'] });
        return Promise.resolve({
          ok: true,
          selection: {
            body,
            contentType: 'image/png',
            kind: 'image',
            name: 'store-icon.png',
            sizeBytes: body.byteLength,
          },
        });
      },
    };

    expect(await pickProjectDeployImage(mediaPicker)).toEqual({
      data: body,
      filename: 'store-icon.png',
    });
  });

  it.each(['cancelled', 'empty-selection', 'picker-failed', 'read-failed'] as const)(
    'returns no deploy image for a %s picker outcome',
    async (reason) => {
      const mediaPicker: ExpoMediaPickerAdapter = {
        pick: () => Promise.resolve({ ok: false, reason }),
      };

      expect(await pickProjectDeployImage(mediaPicker)).toBeNull();
    },
  );
});
