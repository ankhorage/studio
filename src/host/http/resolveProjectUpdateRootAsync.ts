import { pathExists } from '@ankhorage/utility/node/fs';
import path from 'node:path';

import { getProjectPath } from '../orchestrator/projectPaths';

/***
 * Resolve one validated generated project root for APM without requiring its manifest to satisfy
 * the currently running Studio contracts.
 */
export async function resolveProjectUpdateRootAsync(
  workspaceRoot: string,
  projectId: string,
): Promise<string | undefined> {
  try {
    const projectRoot = getProjectPath(workspaceRoot, projectId);
    return (await pathExists(path.join(projectRoot, 'package.json'))) ? projectRoot : undefined;
  } catch {
    return undefined;
  }
}
