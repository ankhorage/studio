import type {
  AppManifest,
  MediaAsset,
  MediaAssetKind,
  MediaAssetReference,
  MediaAssetRegistry,
  UiNode,
} from '@ankhorage/contracts';

export interface StudioMediaUsage {
  readonly screenId: string;
  readonly nodeId: string;
  readonly propertyPath: string;
}

export type StudioMediaAssetRemovalResult =
  | { readonly ok: true; readonly manifest: AppManifest }
  | {
      readonly ok: false;
      readonly reason: 'not-found' | 'in-use';
      readonly usages: readonly StudioMediaUsage[];
    };

export type StudioMediaDeleteResult =
  | { readonly ok: true; readonly cleanup: 'none' | 'removed' }
  | {
      readonly ok: false;
      readonly reason: 'not-found' | 'in-use';
      readonly usages: readonly StudioMediaUsage[];
    }
  | {
      readonly ok: false;
      readonly reason: 'save-failed';
      readonly message: string;
      readonly mediaRemoved: false;
    }
  | {
      readonly ok: false;
      readonly reason: 'cleanup-failed';
      readonly message: string;
      readonly mediaRemoved: true;
    };

export type StudioUrlMediaAssetResult =
  | { readonly ok: true; readonly asset: MediaAsset }
  | { readonly ok: false; readonly error: 'invalid-url' };

export function listStudioMediaAssets(
  manifest: AppManifest,
  mediaKinds?: readonly MediaAssetKind[],
): readonly MediaAsset[] {
  const assets = Object.values(manifest.media?.assets ?? {});
  const filtered = mediaKinds?.length
    ? assets.filter((asset) => mediaKinds.includes(asset.kind))
    : assets;
  return [...filtered].sort((left, right) => left.name.localeCompare(right.name));
}

export function createStudioMediaAssetReference(mediaId: string): MediaAssetReference {
  return { mediaId };
}

export function readStudioMediaAssetReference(value: unknown): MediaAssetReference | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== 'mediaId') return null;
  const { mediaId } = value as { readonly mediaId?: unknown };
  return typeof mediaId === 'string' && mediaId.length > 0 ? { mediaId } : null;
}

export function createStudioMediaAssetId(name: string, registry: MediaAssetRegistry = {}): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'media';
  if (!registry[base]) return base;
  let suffix = 2;
  while (registry[`${base}-${suffix}`]) suffix += 1;
  return `${base}-${suffix}`;
}

export function createStudioUrlMediaAsset(args: {
  readonly id: string;
  readonly name: string;
  readonly kind: MediaAssetKind;
  readonly url: string;
}): StudioUrlMediaAssetResult {
  const url = normalizeStableHttpUrl(args.url);
  if (!url) return { ok: false, error: 'invalid-url' };
  return {
    ok: true,
    asset: {
      id: args.id,
      name: args.name.trim() || args.id,
      kind: args.kind,
      source: { kind: 'url', url },
    },
  };
}

export function upsertStudioMediaAsset(manifest: AppManifest, asset: MediaAsset): AppManifest {
  return {
    ...manifest,
    media: {
      assets: {
        ...(manifest.media?.assets ?? {}),
        [asset.id]: asset,
      },
    },
  };
}

export function collectStudioMediaAssetUsages(
  manifest: AppManifest,
  mediaId: string,
): readonly StudioMediaUsage[] {
  const usages: StudioMediaUsage[] = [];
  for (const [screenId, screen] of Object.entries(manifest.screens)) {
    collectNodeUsages(screenId, screen.root, mediaId, usages);
  }
  return usages;
}

export function removeStudioMediaAsset(
  manifest: AppManifest,
  mediaId: string,
): StudioMediaAssetRemovalResult {
  if (!manifest.media?.assets[mediaId]) {
    return { ok: false, reason: 'not-found', usages: [] };
  }
  const usages = collectStudioMediaAssetUsages(manifest, mediaId);
  if (usages.length > 0) return { ok: false, reason: 'in-use', usages };

  const nextAssets = { ...manifest.media.assets };
  delete nextAssets[mediaId];
  if (Object.keys(nextAssets).length > 0) {
    return { ok: true, manifest: { ...manifest, media: { assets: nextAssets } } };
  }
  const nextManifest = { ...manifest };
  delete nextManifest.media;
  return { ok: true, manifest: nextManifest };
}

function collectNodeUsages(
  screenId: string,
  node: UiNode,
  mediaId: string,
  usages: StudioMediaUsage[],
): void {
  for (const [propertyName, value] of Object.entries(node.props ?? {})) {
    collectValueUsages(screenId, node.id, mediaId, value, propertyName, usages);
  }
  for (const child of node.children ?? []) collectNodeUsages(screenId, child, mediaId, usages);
}

function collectValueUsages(
  screenId: string,
  nodeId: string,
  mediaId: string,
  value: unknown,
  propertyPath: string,
  usages: StudioMediaUsage[],
): void {
  const reference = readStudioMediaAssetReference(value);
  if (reference) {
    if (reference.mediaId === mediaId) usages.push({ screenId, nodeId, propertyPath });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectValueUsages(screenId, nodeId, mediaId, entry, `${propertyPath}.${index}`, usages),
    );
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, entry] of Object.entries(value)) {
    collectValueUsages(screenId, nodeId, mediaId, entry, `${propertyPath}.${key}`, usages);
  }
}

function normalizeStableHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
