import type { AppManifest, ScreenMetadataSpec } from '@ankhorage/contracts';

export type ScreenMetadataManifest = Pick<AppManifest, 'screens'>;

/*** Replace one screen's canonical metadata while preserving its authored UI tree and route identity. */
export function updateStudioScreenMetadata<TManifest extends ScreenMetadataManifest>(
  manifest: TManifest,
  screenId: string,
  metadata: ScreenMetadataSpec,
):
  | { readonly ok: true; readonly manifest: TManifest }
  | { readonly ok: false; readonly manifest: TManifest } {
  if (metadata.id !== screenId) return { ok: false, manifest };

  const screen = Object.entries(manifest.screens).find(([key]) => key === screenId)?.[1];
  if (screen?.id !== screenId) return { ok: false, manifest };

  const {
    title: _currentTitle,
    description: _currentDescription,
    ...screenWithoutOptionalMetadata
  } = screen;
  const nextScreen = {
    ...screenWithoutOptionalMetadata,
    id: metadata.id,
    name: metadata.name,
    ...(metadata.title === undefined ? {} : { title: metadata.title }),
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
  };
  const screens: AppManifest['screens'] = Object.fromEntries(
    Object.entries(manifest.screens).map(([key, value]) => [
      key,
      key === screenId ? nextScreen : value,
    ]),
  );

  return {
    ok: true,
    manifest: {
      ...manifest,
      screens,
    },
  };
}
