# Generated API authoring

`/ankh/apis` supports generated REST/CRUD APIs alongside external APIs. Studio owns only the authoring experience and canonical manifest mutation; shared packages own validation, normalized runtime operations, execution, and infrastructure artifacts.

## Canonical desired state

Generated APIs persist in `AppManifest.generatedApis` as `GeneratedApiDefinition` values from `@ankhorage/contracts`. Resources preserve collection/table identity, schema, primary key, typed fields, required/unique/default flags, selected CRUD operations, and starter seed records.

Studio persists no second generated-backend model.

## Normalized operation projection

Every successful create or update passes the desired definition to `@ankhorage/data-sources`. Its deterministic projection is persisted in the canonical `dataSources` registry as `kind: 'api'`, `origin: 'generated'`, `protocol: 'rest'`.

External and generated operations are therefore enumerated through the same source/endpoint/operation model. Generated database operations are executed by Runtime through their referenced database adapter; Studio does not route them through the external HTTP test runner.

## Infrastructure boundary

Generated collection definitions feed the normal `@ankhorage/infra` database migration path. Studio does not generate SQL, containers, HTTP services, or provider-specific database artifacts.

## Mutation ownership

Create, update, rename, and delete mutations keep generated desired state and its owned normalized projection synchronized. A generated API cannot overwrite an unrelated external or database data source with the same ID. Deleting a generated API removes only the generated projection owned by that definition.

## Runtime database execution

Generated apps using the supported Supabase database provider install the released Supabase DB adapter and register it under every database adapter ID referenced by canonical generated API desired state. Runtime 1 receives that registry through `createRuntimeDataSourceOperationExecutor`; Studio does not execute database operations itself. The generated client uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. When an auth session exists, its access token replaces only the Supabase Authorization header so row-level security evaluates the current user while the anon key remains the client API key. Missing client-safe environment values intentionally leave the registry empty so Runtime returns its structured `missing-adapter` diagnostic.
