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

  const screenDetails = Object.fromEntries(
    Object.entries(screen).filter(
      ([key]) => !['id', 'name', 'title', 'description'].includes(key),
    ),
  );
  const nextScreen = { ...screenDetails, ...metadata };
  const screens = Object.fromEntries(
    Object.entries(manifest.screens).map(([key, value]) => [
      key,
      key === screenId ? nextScreen : value,
    ]),
  ) as AppManifest['screens'];

  return {
    ok: true,
    manifest: {
      ...manifest,
      screens,
    },
  };
}
