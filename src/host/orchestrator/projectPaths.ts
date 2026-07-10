import path from 'node:path';

const PROJECT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const RESERVED_PROJECT_IDS = new Set(['studio']);

export function getAppsRoot(rootPath: string) {
  return path.join(rootPath, 'apps');
}

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

export function getProjectPath(rootPath: string, projectId: string) {
  const appsRoot = path.resolve(getAppsRoot(rootPath));
  const safeId = assertProjectId(projectId);
  const projectPath = path.resolve(appsRoot, safeId);
  if (path.dirname(projectPath) !== appsRoot) {
    throw new Error('Security check failed: project path escaped the workspace apps directory.');
  }
  return projectPath;
}
