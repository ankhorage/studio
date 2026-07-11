export {
  createStudioHost,
  type CreateStudioHostOptions,
  type StudioHost,
} from './createStudioHost';
export { registerProjectSecretRoutes } from './http/secretRoutes';
export { isOriginAllowed } from './http/security';
export {
  createStudioHostServer,
  startStudioHostServer,
  type StartStudioHostServerOptions,
} from './http/server';
export { ModuleManager } from './orchestrator/moduleManager';
export { ProjectManager } from './orchestrator/projectManager';
export { assertProjectId, getAppsRoot, getProjectPath } from './orchestrator/projectPaths';
export { ProjectStore, type ProjectSummary } from './orchestrator/projectStore';
export {
  type BunSupabaseVaultClient,
  createBunSupabaseVaultClient,
} from './secrets/bunSupabaseVaultClient';
export {
  configureManifestOAuthProvider,
  type ConfigureOAuthProviderInput,
  type ConfigureOAuthProviderResult,
  ProjectSecretService,
  type ProjectSecretServiceOptions,
} from './secrets/projectSecretService';
export { resolveProjectSecretDatabaseUrl } from './secrets/resolveProjectSecretDatabaseUrl';
export { getProjectTemplate, getTemplateSummaries } from './templateRegistry';
export { resolveWorkspaceRoot } from './utils/workspaceRoot';
