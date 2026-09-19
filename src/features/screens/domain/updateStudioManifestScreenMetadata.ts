import type { AppManifest, ScreenMetadataSpec, ScreenSpec } from '@ankhorage/contracts';
import { readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

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
  const { description: _description, title: _title, ...stableScreen } = screen;
  return {
    ...stableScreen,
    id: metadata.id,
    name: metadata.name,
    ...(metadata.title === undefined ? {} : { title: metadata.title }),
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
  };
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
