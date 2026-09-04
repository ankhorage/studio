import { getHostModule } from '../modules/catalog';
import type { LayoutMutation } from '../modules/layout';

/***
 * Resolve layout mutations contributed by the selected host modules in module-id order.
 * @todo Move module layout resolution from generic `host/orchestrator` into the `modules/` domain host integration.
 */
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
