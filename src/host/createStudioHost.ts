import { stopAllProjectInfraPortForwards } from './orchestrator/infraRuntime';
import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';

export interface CreateStudioHostOptions {
  readonly workspaceRoot: string;
}

export function createStudioHost(options: CreateStudioHostOptions) {
  const projectManager = new ProjectManager(options.workspaceRoot);
  const moduleManager = new ModuleManager(options.workspaceRoot);
  return {
    workspaceRoot: options.workspaceRoot,
    projectManager,
    moduleManager,
    async close() {
      await stopAllProjectInfraPortForwards();
    },
  };
}

export type StudioHost = ReturnType<typeof createStudioHost>;
