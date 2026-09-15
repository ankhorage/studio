import { createOrchestrator, type Orchestrator } from '@ankhorage/orchestrator';

import { listHostModules } from '../modules/catalog';

/*** Create the canonical Orchestrator instance for Studio's published host module registry. */
export function createHostModuleOrchestrator(projectRoot: string): Orchestrator {
  return createOrchestrator({
    modules: listHostModules().map((module) => module.definition),
    projectRoot,
  });
}
