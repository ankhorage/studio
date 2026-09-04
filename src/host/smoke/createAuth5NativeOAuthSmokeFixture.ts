import { OAUTH_CALLBACK_ROUTE } from '@ankhorage/templates';

import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig';
import { createAuth5NativeOAuthSmokeManifest } from './createAuth5NativeOAuthSmokeManifest';
import { createSmokeProjectSource } from './createSmokeProjectSource';
import { prepareAuth5NativeOAuthSmokeWorkspace } from './prepareAuth5NativeOAuthSmokeWorkspace';

export interface Auth5NativeOAuthSmokeFixture {
  readonly callbackRoute: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}

export async function createAuth5NativeOAuthSmokeFixture(
  workspaceRoot: string,
): Promise<Auth5NativeOAuthSmokeFixture> {
  await prepareAuth5NativeOAuthSmokeWorkspace(workspaceRoot);
  const projectManager = new ProjectManager(workspaceRoot);
  const moduleManager = new ModuleManager(workspaceRoot);
  const created = await projectManager.createProject(
    AUTH5_NATIVE_OAUTH_SMOKE.projectName,
    createSmokeProjectSource(),
    undefined,
    { includeStudio: false },
  );
  await moduleManager.saveProjectManifest({
    projectId: created.id,
    manifest: createAuth5NativeOAuthSmokeManifest(),
  });

  return {
    callbackRoute: OAUTH_CALLBACK_ROUTE,
    projectId: created.id,
    projectRoot: created.path,
    workspaceRoot,
  };
}
