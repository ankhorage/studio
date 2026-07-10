import { MODULE_CATALOG } from '../modules/catalog';
import type { LayoutMutation } from '../modules/layout';

export function resolveModuleLayoutMutations(moduleIds: string[]): LayoutMutation[] {
  const mutations: LayoutMutation[] = [];
  for (const id of moduleIds) {
    const module = MODULE_CATALOG[id];
    if (module?.layout) {
      mutations.push(module.layout);
    }
  }
  return mutations;
}
