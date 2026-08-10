# Generated API authoring

`/ankh/apis` supports generated REST/CRUD APIs alongside external APIs. Studio owns only the authoring experience and canonical manifest mutation; shared packages own validation, normalized runtime operations, execution, and infrastructure artifacts.

## Canonical desired state

Generated APIs persist in `AppManifest.generatedApis` as `GeneratedApiDefinition` values from `@ankhorage/contracts`. Resources preserve collection/table identity, schema, primary key, typed fields, required/unique/default flags, selected CRUD operations, and starter seed records.

Studio never persists a second generated-backend model and does not restore `manifest.data.apis` or `/ankh/datasets`.

## Normalized operation projection

Every successful create or update passes the desired definition to `@ankhorage/data-sources`. Its deterministic projection is persisted in the canonical `dataSources` registry as `kind: 'api'`, `origin: 'generated'`, `protocol: 'rest'`.

External and generated operations are therefore enumerated through the same source/endpoint/operation model. Generated database operations are executed by Runtime through their referenced database adapter; Studio does not route them through the external HTTP test runner.

## Infrastructure boundary

Generated collection definitions feed the normal `@ankhorage/infra` database migration path. Studio does not generate SQL, containers, HTTP services, or provider-specific database artifacts.

## Mutation ownership

Create, update, rename, and delete mutations keep generated desired state and its owned normalized projection synchronized. A generated API cannot overwrite an unrelated external or database data source with the same ID. Deleting a generated API removes only the generated projection owned by that definition.
