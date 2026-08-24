import {
  createExpoMediaPickerAdapter,
  type ExpoMediaPickerAdapter,
} from '@ankhorage/expo-runtime/media-picker';

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

function isDeployImageSelection(filename: string, contentType: string | undefined): boolean {
  if (!/\.(?:png|jpe?g)$/iu.test(filename)) return false;
  return contentType === undefined || contentType === 'image/png' || contentType === 'image/jpeg';
}

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
