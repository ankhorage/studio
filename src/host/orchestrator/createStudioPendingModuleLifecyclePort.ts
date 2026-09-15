import type { Orchestrator } from '@ankhorage/orchestrator';

import type { StudioPendingModuleLifecyclePort } from '../../features/project-updates/application/StudioPendingModuleLifecyclePort';
import { createHostModuleOrchestrator } from './createHostModuleOrchestrator';

/*** Adapt Studio's canonical host Orchestrator registry to the project-update lifecycle port. */
export function createStudioPendingModuleLifecyclePort(): StudioPendingModuleLifecyclePort {
  const orchestrators = new Map<string, Orchestrator>();
  const resolveOrchestrator = (rootPath: string) => {
    const existing = orchestrators.get(rootPath);
    if (existing !== undefined) return existing;
    const created = createHostModuleOrchestrator(rootPath);
    orchestrators.set(rootPath, created);
    return created;
  };

  return {
    isModuleInstalledAsync: async (rootPath, moduleId) =>
      (await resolveOrchestrator(rootPath).getModule(moduleId))?.installed,
    removeModuleAsync: async (rootPath, moduleId) => {
      await resolveOrchestrator(rootPath).removeModule(moduleId);
    },
  };
}
