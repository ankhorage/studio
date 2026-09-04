import { ProjectDeployService } from './deploy/ProjectDeployService';
import { stopAllProjectInfraPortForwards } from './orchestrator/infraSession';
import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';

export interface CreateStudioHostOptions {
  readonly workspaceRoot: string;
}

/***
 * Compose the Studio host edge from project, module, deploy, and infrastructure-session owners.
 * @todo Keep this as thin host composition while moving domain services out of host-owned folders.
 */
export function createStudioHost(options: CreateStudioHostOptions) {
  const projectManager = new ProjectManager(options.workspaceRoot);
  const moduleManager = new ModuleManager(options.workspaceRoot);
  const projectDeployService = new ProjectDeployService({
    projectManager,
    workspaceRoot: options.workspaceRoot,
  });
  return {
    workspaceRoot: options.workspaceRoot,
    projectManager,
    moduleManager,
    projectDeployService,
    /*** Close host-owned infrastructure sessions during Studio host shutdown. */
    async close() {
      await stopAllProjectInfraPortForwards();
    },
  };
}

export type StudioHost = ReturnType<typeof createStudioHost>;
