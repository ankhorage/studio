import type {
  ApiDefinitionRegistry,
  ExternalGraphQlApiDefinition,
  ExternalRestApiDefinition,
} from '@ankhorage/contracts/data';
import { readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

type ExternalApiDefinition = ExternalGraphQlApiDefinition | ExternalRestApiDefinition;

export interface ExternalApiUpsertResult {
  readonly apis: ApiDefinitionRegistry;
  readonly created: boolean;
}

/*** Add or replace one canonical API by stable identity while reporting whether it was newly created. */
export function upsertExternalApi(
  apis: ApiDefinitionRegistry,
  api: ExternalApiDefinition,
): ExternalApiUpsertResult {
  const created = readOwnProperty(apis, api.id) === undefined;
  const next = { ...apis };
  setOwnProperty(next, api.id, api);
  return { apis: next, created };
}
