import type { AppCategory } from '@ankhorage/contracts';

import { isAppCategory } from '../../contractGuards';

export interface WorkspaceCategoryParam {
  category: AppCategory | null;
  categoryParam: string;
}

/***
 * Preserve the raw workspace category route parameter while exposing a validated AppCategory when the shared category contract accepts it.
 * @todo Move this workspace-route parameter policy out of the `app/` composition edge and into the owning `routes/`/`workspace/` domain; the AppCategory guard itself belongs to `@ankhorage/contracts`.
 */
export function resolveWorkspaceCategoryParam(value: string): WorkspaceCategoryParam {
  return {
    category: isAppCategory(value) ? value : null,
    categoryParam: value,
  };
}
