import type {
  SupabaseVaultQueryResult,
  SupabaseVaultSqlClient,
  SupabaseVaultSqlExecutor,
} from '@ankhorage/supabase-vault';
import { SQL } from 'bun';

export interface BunSupabaseVaultClient extends SupabaseVaultSqlClient {
  close(): Promise<void>;
}

/**
 * Trusted server-only PostgreSQL transport for the Supabase Vault adapter.
 *
 * The connection URL must come from Studio host configuration or the generated local Supabase
 * environment. It must never be read from an application manifest or exposed to browser code.
 */
export function createBunSupabaseVaultClient(databaseUrl: string): BunSupabaseVaultClient {
  const normalizedUrl = databaseUrl.trim();
  if (!normalizedUrl) {
    throw new Error('Supabase Vault requires a trusted PostgreSQL database URL.');
  }

  const sql = new SQL(normalizedUrl, {
    adapter: 'postgres',
    max: 4,
    connectionTimeout: 10,
  });

  const query = async <TRow extends Record<string, unknown>>(
    statement: string,
    parameters: readonly unknown[] = [],
  ): Promise<SupabaseVaultQueryResult<TRow>> => {
    const rows = await sql.unsafe(statement, [...parameters]);
    return { rows: rows as readonly TRow[] };
  };

  return {
    query,
    transaction<TResult>(
      operation: (executor: SupabaseVaultSqlExecutor) => Promise<TResult>,
    ): Promise<TResult> {
      return sql.begin((transaction) =>
        operation({
          async query<TRow extends Record<string, unknown>>(
            statement: string,
            parameters: readonly unknown[] = [],
          ): Promise<SupabaseVaultQueryResult<TRow>> {
            const rows = await transaction.unsafe(statement, [...parameters]);
            return { rows: rows as readonly TRow[] };
          },
        }),
      );
    },
    close(): Promise<void> {
      return sql.close({ timeout: 5 });
    },
  };
}
