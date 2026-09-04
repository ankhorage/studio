import type {
  ApiDefinitionList,
  ExternalGraphQlApiDefinition,
  ExternalRestApiDefinition,
} from '@ankhorage/contracts/data';
import { upsertBy } from '@ankhorage/utility/array';

type ExternalApiDefinition = ExternalGraphQlApiDefinition | ExternalRestApiDefinition;

export interface ExternalApiUpsertResult {
  readonly apis: ApiDefinitionList;
  readonly created: boolean;
}

/***
 * Use canonical keyed upsert behavior while reporting Studio's domain-specific creation metadata.
 */
export function upsertExternalApi(
  apis: ApiDefinitionList,
  api: ExternalApiDefinition,
): ExternalApiUpsertResult {
  const created = !apis.some((candidate) => candidate.id === api.id);
  return {
    apis: upsertBy(apis, api, (candidate) => candidate.id),
    created,
  };
}
