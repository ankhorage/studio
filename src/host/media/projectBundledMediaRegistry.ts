import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getExpoBundledMediaRegistrySource } from '@ankhorage/expo-runtime/bundled-media';
import { listFilesRecursive } from '@ankhorage/utility/node/fs';
import { toPortablePath, toRelativeImportPath } from '@ankhorage/utility/node/path';

const AUTHORING_ASSETS_PATH = 'assets/authoring';
const GENERATED_REGISTRY_PATH = 'src/generated/bundledMediaRegistry.ts';

/*** Regenerate the Expo bundled-media registry from the project's authored asset files. */
export async function syncProjectBundledMediaRegistry(projectPath: string): Promise<void> {
  const registryPath = path.join(projectPath, GENERATED_REGISTRY_PATH);
  const files = await listFilesRecursive(path.join(projectPath, AUTHORING_ASSETS_PATH));
  const entries = files.map((filePath) => ({
    path: toPortablePath(path.relative(projectPath, filePath)),
    requirePath: toRelativeImportPath(path.relative(path.dirname(registryPath), filePath)),
  }));
  const source =
    entries.length > 0
      ? getExpoBundledMediaRegistrySource(entries)
      : `import type { ExpoBundledMediaRegistry } from '@ankhorage/expo-runtime/bundled-media';

export const bundledMediaRegistry: ExpoBundledMediaRegistry = {};
`;

  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, source, 'utf8');
}
