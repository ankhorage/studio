import {
  createExpoMediaPickerAdapter,
  type ExpoMediaPickerAdapter,
} from '@ankhorage/expo-runtime/media-picker';

/***
 * Pick and validate a PNG or JPEG image for Studio deploy assets.
 * @todo Move deploy asset-picking policy under src/deploy/ while reusing generic media/file validation helpers.
 */
export async function pickProjectDeployImage(
  mediaPicker: ExpoMediaPickerAdapter = createExpoMediaPickerAdapter(),
): Promise<{
  readonly filename: string;
  readonly data: Uint8Array;
} | null> {
  const result = await mediaPicker.pick({ source: 'file', mediaKinds: ['image'] });
  if (!result.ok) {
    if (result.reason === 'cancelled' || result.reason === 'empty-selection') return null;
    throw new Error(pickerFailureMessage(result.reason));
  }

  if (!isDeployImageSelection(result.selection.name, result.selection.contentType)) {
    throw new Error('Deploy images must be PNG or JPEG files.');
  }

  return {
    filename: result.selection.name,
    data: result.selection.body,
  };
}

/***
 * Validate a filename and optional MIME type against an allowed image-file policy.
 * @utility @ankhorage/utility/media
 */
function isDeployImageSelection(filename: string, contentType: string | undefined): boolean {
  if (!/\.(?:png|jpe?g)$/iu.test(filename)) return false;
  return contentType === undefined || contentType === 'image/png' || contentType === 'image/jpeg';
}

/***
 * Map Expo media-picker failure reasons to user-facing failure messages.
 * @todo Move this reusable media-picker reason mapping to @ankhorage/expo-runtime/media-picker or expose it there.
 */
function pickerFailureMessage(
  reason: 'picker-failed' | 'read-failed' | 'unsupported-kind',
): string {
  switch (reason) {
    case 'picker-failed':
      return 'The image picker could not be opened.';
    case 'read-failed':
      return 'The selected image could not be read.';
    case 'unsupported-kind':
      return 'The selected file is not a supported image.';
  }
}
