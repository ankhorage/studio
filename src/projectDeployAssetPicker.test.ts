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

  it.each(['cancelled', 'empty-selection'] as const)(
    'returns no deploy image for a %s outcome',
    async (reason) => {
      const mediaPicker: ExpoMediaPickerAdapter = {
        pick: () => Promise.resolve({ ok: false, reason }),
      };

      expect(await pickProjectDeployImage(mediaPicker)).toBeNull();
    },
  );

  it.each([
    ['picker-failed', 'The image picker could not be opened.'],
    ['read-failed', 'The selected image could not be read.'],
    ['unsupported-kind', 'The selected file is not a supported image.'],
  ] as const)('surfaces a %s outcome', (reason, message) => {
    const mediaPicker: ExpoMediaPickerAdapter = {
      pick: () => Promise.resolve({ ok: false, reason }),
    };

    expect(pickProjectDeployImage(mediaPicker)).rejects.toThrow(message);
  });

  it.each([
    ['animation.gif', 'image/gif'],
    ['store-icon.webp', 'image/webp'],
    ['store-icon.png', 'image/gif'],
  ] as const)('rejects the non-PNG/JPEG selection %s (%s)', (name, contentType) => {
    const mediaPicker: ExpoMediaPickerAdapter = {
      pick: () =>
        Promise.resolve({
          ok: true,
          selection: {
            body: new Uint8Array([1, 2, 3]),
            contentType,
            kind: 'image',
            name,
            sizeBytes: 3,
          },
        }),
    };

    expect(pickProjectDeployImage(mediaPicker)).rejects.toThrow(
      'Deploy images must be PNG or JPEG files.',
    );
  });
});
