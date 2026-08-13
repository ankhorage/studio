import { promises as fs } from 'node:fs';
import path from 'node:path';

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

function isDirectoryNotEmpty(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOTEMPTY';
}

function isMissingPath(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
