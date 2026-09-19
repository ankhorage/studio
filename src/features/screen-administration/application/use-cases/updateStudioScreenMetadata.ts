import type { AppManifest, ScreenMetadataSpec } from '@ankhorage/contracts';

/*** Replace one screen's canonical metadata while preserving its authored UI tree and route identity. */
export function updateStudioScreenMetadata(
  manifest: AppManifest,
  screenId: string,
  metadata: ScreenMetadataSpec,
) {
  if (metadata.id !== screenId) return { ok: false as const, manifest };

  const entry = Object.entries(manifest.screens).find(([key]) => key === screenId);
  const screen = entry?.[1];
  if (!screen || screen.id !== screenId) return { ok: false as const, manifest };

  const { id: _id, name: _name, title: _title, description: _description, ...screenDetails } = screen;
  const nextScreen = { ...screenDetails, ...metadata };
  const screens = Object.fromEntries(
    Object.entries(manifest.screens).map(([key, value]) => [
      key,
      key === screenId ? nextScreen : value,
    ]),
  );

  return {
    ok: true as const,
    manifest: {
      ...manifest,
      screens,
    },
  };
}
