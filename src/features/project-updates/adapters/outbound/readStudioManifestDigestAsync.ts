import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { digestProjectUpdateText } from './readPendingModuleLifecycleStateAsync';

const STUDIO_MANIFEST_FILE = 'ankh.config.json';

/*** Read the canonical Studio manifest bytes and digest used as an irreversible-effect precondition. */
export async function readStudioManifestDigestAsync(rootPath: string): Promise<string> {
  return digestProjectUpdateText(await readFile(path.join(rootPath, STUDIO_MANIFEST_FILE), 'utf8'));
}
