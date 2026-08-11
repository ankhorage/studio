import { getHostModule } from '../modules/catalog';
import type { LayoutMutation } from '../modules/layout';

export function resolveModuleLayoutMutations(moduleIds: string[]): LayoutMutation[] {
  const mutations: LayoutMutation[] = [];
  for (const id of moduleIds) {
    const module = getHostModule(id);
    if (module?.layout) {
      mutations.push(module.layout);
    }
  }
  return mutations;
}
