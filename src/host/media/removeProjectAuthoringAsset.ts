import path from 'node:path';

import { removeFileWithinRoot } from '@ankhorage/utility/node/fs';

/***
 * Remove one bundled authoring asset only when its resolved destination stays inside the authoring root, then prune empty parents.
 */
export async function removeProjectAuthoringAsset(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const authoringRoot = path.resolve(projectPath, 'assets/authoring');
  const destination = path.resolve(projectPath, relativePath);
  await removeFileWithinRoot({
    rootPath: authoringRoot,
    filePath: destination,
    pruneEmptyParents: true,
  });
}
