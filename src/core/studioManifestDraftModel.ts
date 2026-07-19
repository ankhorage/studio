import type {
  AppDataManifest,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
} from '@ankhorage/contracts';

import { applyStudioAuthSettings, type StudioAuthSettings } from '../authSettings';
import type { StudioManifest, StudioNodeId, ThemeUpdates } from '../index';
import {
  findScreenIdForNode,
  updateStudioManifestAppData,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
  updateStudioManifestNode,
  updateStudioManifestTheme,
} from '../manifestState';

export type StudioManifestDraftMutation = (current: StudioManifest) => StudioManifest;

export function applyStudioManifestDraftMutation(
  current: StudioManifest | null,
  mutation: StudioManifestDraftMutation,
): StudioManifest | null {
  return current ? mutation(current) : null;
}

export function updateStudioManifestDraftNode(
  manifest: StudioManifest,
  nodeId: StudioNodeId,
  props: Record<string, unknown>,
): StudioManifest {
  const owningScreenId = findScreenIdForNode(manifest, nodeId);
  if (!owningScreenId) return manifest;
  return updateStudioManifestNode(manifest, owningScreenId, nodeId, props);
}

export function updateStudioManifestDraftTheme(
  manifest: StudioManifest,
  id: string,
  updates: ThemeUpdates,
): StudioManifest {
  return updateStudioManifestTheme(manifest, id, updates);
}

export function updateStudioManifestDraftAuthSettings(
  manifest: StudioManifest,
  settings: StudioAuthSettings,
): StudioManifest {
  return replaceStudioManifestDraftAuthSettings(manifest, settings);
}

export function replaceStudioManifestDraftAuthSettings(
  manifest: StudioManifest,
  settings: StudioAuthSettings | null,
): StudioManifest {
  if (!settings) {
    const { auth: _auth, ...infra } = manifest.infra;
    return { ...manifest, infra };
  }

  return applyStudioAuthSettings(manifest, settings);
}

export function updateStudioManifestDraftAppData(
  manifest: StudioManifest,
  data: AppDataManifest,
): StudioManifest {
  return updateStudioManifestAppData(manifest, data);
}

export function updateStudioManifestDraftDataBindings(
  manifest: StudioManifest,
  dataBindings: ComponentDataBindingRegistry,
): StudioManifest {
  return updateStudioManifestDataBindings(manifest, dataBindings);
}

export function updateStudioManifestDraftDataSources(
  manifest: StudioManifest,
  dataSources: DataSourceRegistry,
): StudioManifest {
  return updateStudioManifestDataSources(manifest, dataSources);
}
