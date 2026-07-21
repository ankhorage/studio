import type { AppCategory } from '@ankhorage/contracts';

import { isAppCategory } from '../../contractGuards';

export interface WorkspaceCategoryParam {
  category: AppCategory | null;
  categoryParam: string;
}

export function resolveWorkspaceCategoryParam(value: string): WorkspaceCategoryParam {
  return {
    category: isAppCategory(value) ? value : null,
    categoryParam: value,
  };
}
