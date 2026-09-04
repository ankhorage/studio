import type {
  ApiDefinitionList,
  ExternalGraphQlApiDefinition,
  ExternalRestApiDefinition,
} from '@ankhorage/contracts/data';

type ExternalApiDefinition = ExternalGraphQlApiDefinition | ExternalRestApiDefinition;

export interface ExternalApiUpsertResult {
  readonly apis: ApiDefinitionList;
  readonly created: boolean;
}

/***
 * Immutably insert or replace an item in an array by stable identity and report whether it was created.
 * @utility @ankhorage/utility/array
 */
export function upsertExternalApi(
  apis: ApiDefinitionList,
  api: ExternalApiDefinition,
): ExternalApiUpsertResult {
  const index = apis.findIndex((candidate) => candidate.id === api.id);
  if (index < 0) return { apis: [...apis, api], created: true };

  return {
    apis: apis.map((candidate, candidateIndex) => (candidateIndex === index ? api : candidate)),
    created: false,
  };
}
