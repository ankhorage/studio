import { promises as fs } from 'node:fs';
import path from 'node:path';

import { pruneEmptyDirectories } from '@ankhorage/utility/node/fs';

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
