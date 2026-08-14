import { OAUTH_CALLBACK_ROUTE } from '@ankhorage/templates';

import { ModuleManager } from '../orchestrator/moduleManager.js';
import { ProjectManager } from '../orchestrator/projectManager.js';
import { getTemplateCatalog } from '../templateRegistry.js';
import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig.js';
import { createAuth5NativeOAuthSmokeManifest } from './createAuth5NativeOAuthSmokeManifest.js';
import { prepareAuth5NativeOAuthSmokeWorkspace } from './prepareAuth5NativeOAuthSmokeWorkspace.js';

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
  const template = getTemplateCatalog()
    .categories.find((candidate) => candidate.id === 'developer_tools')
    ?.templates.at(0);
  if (!template) throw new Error('Developer-tools template is unavailable.');

  const created = await projectManager.createProject(
    AUTH5_NATIVE_OAUTH_SMOKE.projectName,
    { category: 'developer_tools', templateId: template.templateId },
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
