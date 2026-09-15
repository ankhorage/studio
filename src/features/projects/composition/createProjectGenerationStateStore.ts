import { ProjectGenerationStateStore } from '../adapters/outbound/ProjectGenerationStateStore';

/*** Compose Studio's canonical generated-project state store for host project lifecycle orchestration. */
export function createProjectGenerationStateStore(): ProjectGenerationStateStore {
  return new ProjectGenerationStateStore();
}
