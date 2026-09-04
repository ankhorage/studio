import type { ComponentDataBindingRegistry, DataSourceRegistry } from '@ankhorage/contracts';

import { applyStudioAuthSettings, type StudioAuthSettings } from '../authSettings';
import type { StudioManifest, StudioNodeId, ThemeUpdates } from '../index';
import {
  findScreenIdForNode,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
  updateStudioManifestNode,
  updateStudioManifestTheme,
} from '../manifestState';

export type StudioManifestDraftMutation = (current: StudioManifest) => StudioManifest;

/***
 * Apply a manifest mutation only when a Studio manifest draft currently exists.
 * @todo Move draft mutation orchestration out of core into the manifest application responsibility.
 */
export function applyStudioManifestDraftMutation(
  current: StudioManifest | null,
  mutation: StudioManifestDraftMutation,
): StudioManifest | null {
  return current ? mutation(current) : null;
}

/***
 * Update a node in the manifest draft after resolving which screen owns that node.
 * @todo Review with canvas/manifest boundaries when splitting manifestState by domain ownership.
 */
export function updateStudioManifestDraftNode(
  manifest: StudioManifest,
  nodeId: StudioNodeId,
  props: Record<string, unknown>,
): StudioManifest {
  const owningScreenId = findScreenIdForNode(manifest, nodeId);
  if (!owningScreenId) return manifest;
  return updateStudioManifestNode(manifest, owningScreenId, nodeId, props);
}

/***
 * Apply theme updates to a Studio manifest draft.
 * @todo Move theme authoring behavior to its owning domain when the Studio target structure defines that responsibility.
 */
export function updateStudioManifestDraftTheme(
  manifest: StudioManifest,
  id: string,
  updates: ThemeUpdates,
): StudioManifest {
  return updateStudioManifestTheme(manifest, id, updates);
}

/***
 * Replace the Studio auth settings in a manifest draft with a non-null settings value.
 * @todo Move auth-specific manifest mutation into the auth domain.
 */
export function updateStudioManifestDraftAuthSettings(
  manifest: StudioManifest,
  settings: StudioAuthSettings,
): StudioManifest {
  return replaceStudioManifestDraftAuthSettings(manifest, settings);
}

/***
 * Replace or remove the auth settings stored in a Studio manifest draft.
 * @todo Move auth-specific manifest mutation into the auth domain.
 */
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

/***
 * Replace the component data-binding registry in a Studio manifest draft.
 * @todo Move binding-specific manifest mutation into the bindings domain.
 */
export function updateStudioManifestDraftDataBindings(
  manifest: StudioManifest,
  dataBindings: ComponentDataBindingRegistry,
): StudioManifest {
  return updateStudioManifestDataBindings(manifest, dataBindings);
}

/***
 * Replace the data-source registry in a Studio manifest draft.
 * @todo Review data-source ownership with bindings/external-apis before structural migration.
 */
export function updateStudioManifestDraftDataSources(
  manifest: StudioManifest,
  dataSources: DataSourceRegistry,
): StudioManifest {
  return updateStudioManifestDataSources(manifest, dataSources);
}
