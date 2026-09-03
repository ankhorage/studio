import type { StudioManifest } from './index';
import { setOwnProperty } from './utils/setOwnProperty';

interface RuntimeScreenSignature {
  id: string;
  name: string;
  title?: string;
}

/***
 * Reduce the screen registry to the stable fields that participate in runtime synchronization.
 * @todo Move this manifest synchronization helper from the src root into the manifest domain.
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
 * Serialize only manifest fields whose changes require generated runtime synchronization.
 * @todo Move this manifest synchronization policy from the src root into the manifest domain.
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
 * Serialize the complete Studio manifest to produce an equality signature for persistence tracking.
 * @todo Move this manifest persistence helper from the src root into the manifest domain.
 */
export function createStudioManifestSignature(manifest: StudioManifest): string {
  return JSON.stringify(manifest);
}
