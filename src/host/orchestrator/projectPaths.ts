import path from 'node:path';

const PROJECT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const RESERVED_PROJECT_IDS = new Set(['studio']);

/***
 * Resolve the Studio workspace directory containing generated application projects.
 * @todo Move project path policy from generic `host/orchestrator` into the `projects/` domain host edge.
 */
export function getAppsRoot(rootPath: string) {
  return path.join(rootPath, 'apps');
}

/***
 * Validate the Studio project-id contract before it is used as a filesystem segment.
 * @todo Keep project-id policy with the `projects/` domain rather than generic host orchestration.
 */
export function assertProjectId(projectId: string) {
  if (
    projectId.length === 0 ||
    path.basename(projectId) !== projectId ||
    !PROJECT_ID_PATTERN.test(projectId) ||
    RESERVED_PROJECT_IDS.has(projectId)
  ) {
    throw new Error(`Invalid project id: ${projectId}`);
  }
  return projectId;
}

/***
 * Resolve a validated Studio project id beneath the workspace apps root and reject path escape.
 * @todo Move project filesystem location policy into the `projects/` domain host edge; generic bounded-path resolution can use Utility.
 */
export function getProjectPath(rootPath: string, projectId: string) {
  const appsRoot = path.resolve(getAppsRoot(rootPath));
  const safeId = assertProjectId(projectId);
  const projectPath = path.resolve(appsRoot, safeId);
  if (path.dirname(projectPath) !== appsRoot) {
    throw new Error('Security check failed: project path escaped the workspace apps directory.');
  }
  return projectPath;
}
