import { promises as fs } from 'node:fs';
import path from 'node:path';

/***
 * Remove one bundled authoring asset only when its resolved destination stays inside the authoring root, then prune empty parents.
 * @utility @ankhorage/utility/node/fs
 */
export async function removeProjectAuthoringAsset(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const authoringRoot = path.resolve(projectPath, 'assets/authoring');
  const destination = path.resolve(projectPath, relativePath);
  if (destination === authoringRoot || !destination.startsWith(`${authoringRoot}${path.sep}`)) {
    throw new Error('Bundled media path is outside the project authoring assets directory.');
  }

  await fs.rm(destination, { force: true });
  await pruneEmptyDirectories(path.dirname(destination), authoringRoot);
}

/***
 * Remove empty directories from a starting directory upward until reaching a protected root.
 * @utility @ankhorage/utility/node/fs
 */
async function pruneEmptyDirectories(directory: string, root: string): Promise<void> {
  let current = directory;
  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    try {
      await fs.rmdir(current);
    } catch (error) {
      if (isDirectoryNotEmpty(error)) return;
      if (!isMissingPath(error)) throw error;
    }
    current = path.dirname(current);
  }
}

/***
 * Detect a Node filesystem error indicating that a directory is not empty.
 * @utility @ankhorage/utility/node/fs
 */
function isDirectoryNotEmpty(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOTEMPTY';
}

/***
 * Detect a Node filesystem error indicating that a path does not exist.
 * @utility @ankhorage/utility/node/fs
 */
function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
