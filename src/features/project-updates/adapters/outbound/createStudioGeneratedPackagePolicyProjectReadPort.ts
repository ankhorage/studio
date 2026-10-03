import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { ApmExtensionProjectReadPort, ApmProjectFileSnapshot } from '@ankhorage/apm/types';
import { isMissingPathError } from '@ankhorage/utility/node/fs';
import { resolvePathWithinRoot } from '@ankhorage/utility/node/path';

/*** Create bounded read-only project capabilities for Studio package-policy inspection and planning. */
export function createStudioGeneratedPackagePolicyProjectReadPort(
  rootPath: string,
): ApmExtensionProjectReadPort {
  const readFileAsync = async (relativePath: string): Promise<ApmProjectFileSnapshot> => {
    const filePath = resolvePathWithinRoot(rootPath, relativePath);
    try {
      const content = await readFile(filePath, 'utf8');
      return {
        path: relativePath,
        exists: true,
        digest: createHash('sha256').update(content).digest('hex'),
        encoding: 'utf8',
        content,
      };
    } catch (error) {
      if (isMissingPathError(error)) return { path: relativePath, exists: false };
      throw error;
    }
  };
  return {
    readFileAsync,
    listFilesAsync: async (scope) =>
      scope.kind === 'dynamic' ? [] : [await readFileAsync(scope.path)],
  };
}
