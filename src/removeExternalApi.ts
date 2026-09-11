import type { ApiDefinitionList } from '@ankhorage/contracts/data';

export interface ExternalApiRemovalResult {
  readonly apis: ApiDefinitionList;
  readonly removed: boolean;
}

/*** Remove exactly one canonical API id from an API definition list without affecting similarly named entries. */
export function removeExternalApi(
  apis: ApiDefinitionList,
  apiId: string,
): ExternalApiRemovalResult {
  const next = apis.filter((api) => api.id !== apiId);
  return {
    apis: next,
    removed: next.length !== apis.length,
  };
}
