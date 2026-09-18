import type { ApiDefinitionRegistry } from '@ankhorage/contracts/data';
import { deleteOwnProperty, readOwnProperty } from '@ankhorage/utility/object';

export interface ExternalApiRemovalResult {
  readonly apis: ApiDefinitionRegistry;
  readonly removed: boolean;
}

/*** Remove exactly one canonical API id from the API registry without affecting other entries. */
export function removeExternalApi(
  apis: ApiDefinitionRegistry,
  apiId: string,
): ExternalApiRemovalResult {
  if (readOwnProperty(apis, apiId) === undefined) return { apis, removed: false };
  const next = { ...apis };
  deleteOwnProperty(next, apiId);
  return { apis: next, removed: true };
}
