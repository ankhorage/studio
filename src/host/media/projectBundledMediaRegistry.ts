import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getExpoBundledMediaRegistrySource } from '@ankhorage/expo-runtime/bundled-media';

const AUTHORING_ASSETS_PATH = 'assets/authoring';
const GENERATED_REGISTRY_PATH = 'src/generated/bundledMediaRegistry.ts';

/*** Regenerate the Expo bundled-media registry from the project's authored asset files. */
export async function syncProjectBundledMediaRegistry(projectPath: string): Promise<void> {
  const registryPath = path.join(projectPath, GENERATED_REGISTRY_PATH);
  const files = await listFiles(path.join(projectPath, AUTHORING_ASSETS_PATH));
  const entries = files.map((filePath) => ({
    path: toPortablePath(path.relative(projectPath, filePath)),
    requirePath: toRequirePath(path.relative(path.dirname(registryPath), filePath)),
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

/***
 * Recursively list files under a root in deterministic lexical order, returning an empty list when the root is absent.
 * @utility @ankhorage/utility/node/fs
 */
async function listFiles(rootPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

/***
 * Convert platform-specific path separators to portable forward slashes.
 * @utility @ankhorage/utility/node/path
 */
function toPortablePath(value: string): string {
  return value.split(path.sep).join('/');
}

/***
 * Convert a relative filesystem path to a portable relative module import path.
 * @utility @ankhorage/utility/node/path
 */
function toRequirePath(value: string): string {
  const portable = toPortablePath(value);
  return portable.startsWith('.') ? portable : `./${portable}`;
}

/***
 * Detect a Node filesystem error indicating that a path does not exist.
 * @utility @ankhorage/utility/node/fs
 */
function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
