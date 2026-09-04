import { promises as fs } from 'node:fs';
import path from 'node:path';

/***
 * Write one bundled authoring asset only when its resolved destination stays inside the authoring root.
 * @utility @ankhorage/utility/node/fs
 */
export async function writeProjectAuthoringAsset(
  projectPath: string,
  relativePath: string,
  body: Uint8Array,
): Promise<void> {
  const authoringRoot = path.resolve(projectPath, 'assets/authoring');
  const destination = path.resolve(projectPath, relativePath);
  if (destination !== authoringRoot && !destination.startsWith(`${authoringRoot}${path.sep}`)) {
    throw new Error('Bundled media path escaped the project authoring assets directory.');
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, body, { flag: 'wx' });
}
