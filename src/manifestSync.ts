import type { StudioManifest } from './index';

interface RuntimeScreenSignature {
  id: string;
  name: string;
  title?: string;
}

function createRuntimeScreenSignatures(
  manifest: StudioManifest,
): Record<string, RuntimeScreenSignature> {
  return Object.entries(manifest.screens)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .reduce<Record<string, RuntimeScreenSignature>>((acc, [screenId, screen]) => {
      acc[screenId] = {
        id: screen.id,
        name: screen.name,
        title: screen.title,
      };
      return acc;
    }, {});
}

export function createStudioRuntimeSyncSignature(manifest: StudioManifest): string {
  return JSON.stringify({
    navigator: manifest.navigator,
    screens: createRuntimeScreenSignatures(manifest),
    data: manifest.data ?? {},
    dataBindings: manifest.dataBindings ?? {},
    dataSources: manifest.dataSources ?? {},
    auth: manifest.infra.auth ?? null,
    plugins: [...manifest.infra.plugins].sort(),
  });
}

export function createStudioManifestSignature(manifest: StudioManifest): string {
  return JSON.stringify(manifest);
}
