import type {
  SupabaseVaultQueryResult,
  SupabaseVaultSqlClient,
  SupabaseVaultSqlExecutor,
} from '@ankhorage/supabase-vault';
import { SQL } from 'bun';

export interface BunSupabaseVaultClient extends SupabaseVaultSqlClient {
  close(): Promise<void>;
}

/***
 * @todo Keep this concrete Bun/PostgreSQL transport at the Secrets host edge; it is an adapter for the Supabase Vault owner, not a generic Utility capability.
 * Create the trusted server-only PostgreSQL client used by the Supabase Vault adapter.
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
    const rawRows: unknown = await sql.unsafe(statement, [...parameters]);
    return { rows: assertRows<TRow>(rawRows) };
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
            const rawRows: unknown = await transaction.unsafe(statement, [...parameters]);
            return { rows: assertRows<TRow>(rawRows) };
          },
        }),
      );
    },
    close(): Promise<void> {
      return sql.close({ timeout: 5 });
    },
  };
}

/***
 * @utility @ankhorage/utility/value
 * Assert that an unknown database result is an array before exposing it to a typed row boundary.
 */
function assertRows<TRow extends Record<string, unknown>>(value: unknown): readonly TRow[] {
  if (!Array.isArray(value)) {
    throw new Error('Supabase Vault query returned an unexpected result shape.');
  }

  return value as readonly TRow[];
}
