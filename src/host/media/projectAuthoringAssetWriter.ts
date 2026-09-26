import { promises as fs } from 'node:fs';
import path from 'node:path';

import { writeFileWithinRoot } from '@ankhorage/utility/node/fs';
import { resolvePathWithinRoot } from '@ankhorage/utility/node/path';

/***
 * Write one bundled authoring asset only when its resolved destination stays inside the authoring root.
 */
export async function writeProjectAuthoringAsset(
  projectPath: string,
  relativePath: string,
  body: Uint8Array,
): Promise<void> {
  const authoringRoot = path.resolve(projectPath, 'assets/authoring');
  const destination = path.resolve(projectPath, relativePath);
  try {
    resolvePathWithinRoot(authoringRoot, path.relative(authoringRoot, destination));
  } catch {
    throw new Error('Bundled media path escaped the project authoring assets directory.');
  }
  await fs.mkdir(authoringRoot, { recursive: true });
  await writeFileWithinRoot({ rootPath: authoringRoot, filePath: destination, body });
}
