import type {
  SupabaseVaultQueryResult,
  SupabaseVaultSqlClient,
  SupabaseVaultSqlExecutor,
} from '@ankhorage/supabase-vault';

import {
  type BunSupabaseVaultClient,
  createBunSupabaseVaultClient,
} from './bunSupabaseVaultClient';
import {
  type ResolveProjectSecretDatabaseUrlInput,
  resolveProjectSecretDatabaseUrl,
} from './resolveProjectSecretDatabaseUrl';

/*** Create a lazy trusted Vault SQL client that opens and closes one Bun connection per operation. */
export function createScopedBunSupabaseVaultClient(
  options: {
    readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
    readonly createClient?: (databaseUrl: string) => BunSupabaseVaultClient;
    readonly resolveDatabaseUrl?: (
      input?: ResolveProjectSecretDatabaseUrlInput,
    ) => string;
  } = {},
): SupabaseVaultSqlClient {
  const dependencies: ScopedSupabaseVaultClientDependencies = {
    processEnvironment: options.processEnvironment,
    createClient: options.createClient ?? createBunSupabaseVaultClient,
    resolveDatabaseUrl: options.resolveDatabaseUrl ?? resolveProjectSecretDatabaseUrl,
  };

  return {
    query<TRow extends Record<string, unknown>>(
      statement: string,
      parameters: readonly unknown[] = [],
    ): Promise<SupabaseVaultQueryResult<TRow>> {
      return withClientAsync(dependencies, (client) =>
        client.query<TRow>(statement, parameters),
      );
    },
    transaction<TResult>(
      operation: (executor: SupabaseVaultSqlExecutor) => Promise<TResult>,
    ): Promise<TResult> {
      return withClientAsync(dependencies, (client) => client.transaction(operation));
    },
  };
}

interface ScopedSupabaseVaultClientDependencies {
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
  readonly createClient: (databaseUrl: string) => BunSupabaseVaultClient;
  readonly resolveDatabaseUrl: (
    input?: ResolveProjectSecretDatabaseUrlInput,
  ) => string;
}

/*** Resolve trusted connection state for one Vault operation and close it on success or failure. */
async function withClientAsync<TResult>(
  dependencies: ScopedSupabaseVaultClientDependencies,
  operation: (client: BunSupabaseVaultClient) => Promise<TResult>,
): Promise<TResult> {
  const databaseUrl = dependencies.resolveDatabaseUrl(
    dependencies.processEnvironment === undefined
      ? {}
      : { processEnvironment: dependencies.processEnvironment },
  );
  const client = dependencies.createClient(databaseUrl);
  try {
    return await operation(client);
  } finally {
    await client.close();
  }
}
