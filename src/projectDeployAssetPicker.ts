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
  if (!result.ok) return null;

  return {
    filename: result.selection.name,
    data: result.selection.body,
  };
}
