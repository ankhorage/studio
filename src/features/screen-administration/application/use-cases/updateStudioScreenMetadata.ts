import type { AppManifest, ScreenMetadataSpec } from '@ankhorage/contracts';

export type ScreenMetadataManifest = Pick<AppManifest, 'screens'>;

/*** Replace one screen's canonical metadata while preserving its authored UI tree and route identity. */
export function updateStudioScreenMetadata<TManifest extends ScreenMetadataManifest>(
  manifest: TManifest,
  screenId: string,
  metadata: ScreenMetadataSpec,
): { readonly ok: true; readonly manifest: TManifest } | { readonly ok: false; readonly manifest: TManifest } {
  if (metadata.id !== screenId) return { ok: false, manifest };

  const screen = Object.entries(manifest.screens).find(([key]) => key === screenId)?.[1];
  if (!screen || screen.id !== screenId) return { ok: false, manifest };

  const nextScreen = {
    ...screen,
    id: metadata.id,
    name: metadata.name,
    title: metadata.title,
    description: metadata.description,
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
