import { setOwnProperty } from '@ankhorage/utility/object';

import type { StudioManifest } from './index';

interface RuntimeScreenSignature {
  id: string;
  name: string;
  title?: string;
}

/***
 * Build the sorted screen subset used to detect runtime-relevant manifest changes.
 * @todo Move manifest signature behavior from the source root into the manifest domain.
 */
function createRuntimeScreenSignatures(
  manifest: StudioManifest,
): Record<string, RuntimeScreenSignature> {
  return Object.entries(manifest.screens)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .reduce<Record<string, RuntimeScreenSignature>>((acc, [screenId, screen]) => {
      setOwnProperty(acc, screenId, {
        id: screen.id,
        name: screen.name,
        title: screen.title,
      });
      return acc;
    }, {});
}

/***
 * Serialize only the manifest fields that affect generated runtime synchronization.
 * @todo Move manifest signature behavior from the source root into the manifest domain.
 */
export function createStudioRuntimeSyncSignature(manifest: StudioManifest): string {
  return JSON.stringify({
    navigator: manifest.navigator,
    screens: createRuntimeScreenSignatures(manifest),
    apis: manifest.infra.apis ?? [],
    dataBindings: manifest.dataBindings ?? {},
    dataSources: manifest.dataSources ?? {},
    auth: manifest.infra.auth ?? null,
    modules: [...manifest.infra.modules].sort(),
  });
}

/***
 * Serialize the complete manifest for exact persistence-change comparison.
 * @todo Move manifest signature behavior from the source root into the manifest domain.
 */
export function createStudioManifestSignature(manifest: StudioManifest): string {
  return JSON.stringify(manifest);
}
