import type { AppManifest, ScreenMetadataSpec, ScreenSpec } from '@ankhorage/contracts';
import { deleteOwnProperty, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

/*** Replace canonical screen metadata while preserving the screen body and every unrelated manifest branch. */
export function updateStudioManifestScreenMetadata(
  manifest: AppManifest,
  screenId: string,
  metadata: ScreenMetadataSpec,
): AppManifest {
  if (metadata.id !== screenId) return manifest;
  const current = readOwnProperty(manifest.screens, screenId);
  if (!current || current.id !== screenId) return manifest;

  const nextScreen = createScreenWithMetadata(current, metadata);
  if (isSameMetadata(current, nextScreen)) return manifest;

  const screens: Record<string, ScreenSpec> = { ...manifest.screens };
  setOwnProperty(screens, screenId, nextScreen);
  return { ...manifest, screens };
}

/*** Copy authored metadata onto one ScreenSpec without touching its UI tree, loaders, or requirements. */
function createScreenWithMetadata(
  screen: ScreenSpec,
  metadata: ScreenMetadataSpec,
): ScreenSpec {
  const next: ScreenSpec = {
    ...screen,
    id: metadata.id,
    name: metadata.name,
  };
  writeOptionalString(next, 'title', metadata.title);
  writeOptionalString(next, 'description', metadata.description);
  return next;
}

/*** Write or remove one optional screen metadata string on a cloned ScreenSpec. */
function writeOptionalString(
  screen: ScreenSpec,
  key: 'description' | 'title',
  value: string | undefined,
): void {
  if (value === undefined) deleteOwnProperty(screen, key);
  else setOwnProperty(screen, key, value);
}

/*** Compare only the canonical metadata fields owned by ScreenMetadataSpec. */
function isSameMetadata(left: ScreenMetadataSpec, right: ScreenMetadataSpec): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.title === right.title &&
    left.description === right.description
  );
}
