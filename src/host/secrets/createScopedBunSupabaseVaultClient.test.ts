import type { SupabaseVaultQueryResult, SupabaseVaultSqlExecutor } from '@ankhorage/supabase-vault';
import { expect, test } from 'bun:test';

import type { BunSupabaseVaultClient } from './bunSupabaseVaultClient';
import { createScopedBunSupabaseVaultClient } from './createScopedBunSupabaseVaultClient';

test('opens trusted Vault SQL lazily and closes it after a transaction', async () => {
  const client = new RecordingBunSupabaseVaultClient();
  const createdUrls: string[] = [];
  const scoped = createScopedBunSupabaseVaultClient({
    processEnvironment: {
      ANKH_SECRET_STORE_DATABASE_URL: ' postgres://trusted/database ',
    },
    createClient: (databaseUrl) => {
      createdUrls.push(databaseUrl);
      return client;
    },
  });

  const result = await scoped.transaction(async (executor) => {
    await executor.query('delete from vault.secrets');
    return 'done';
  });

  expect(result).toBe('done');
  expect(createdUrls).toEqual(['postgres://trusted/database']);
  expect(client.transactionCount).toBe(1);
  expect(client.queryCount).toBe(1);
  expect(client.closeCount).toBe(1);
});

test('closes trusted Vault SQL when an operation fails', async () => {
  const client = new RecordingBunSupabaseVaultClient(true);
  const scoped = createScopedBunSupabaseVaultClient({
    processEnvironment: {
      ANKH_SECRET_STORE_DATABASE_URL: 'postgres://trusted/database',
    },
    createClient: () => client,
  });

  const outcome = await scoped.query('select broken').then(
    () => 'resolved',
    (error: unknown) => error,
  );
  expect(outcome).toEqual(new Error('query failed'));
  expect(client.closeCount).toBe(1);
});

class RecordingBunSupabaseVaultClient implements BunSupabaseVaultClient {
  queryCount = 0;
  transactionCount = 0;
  closeCount = 0;

  constructor(private readonly failQuery = false) {}

  query<TRow extends Record<string, unknown>>(
    _statement: string,
    _parameters: readonly unknown[] = [],
  ): Promise<SupabaseVaultQueryResult<TRow>> {
    this.queryCount += 1;
    return this.failQuery
      ? Promise.reject(new Error('query failed'))
      : Promise.resolve({ rows: [] });
  }

  transaction<TResult>(
    operation: (executor: SupabaseVaultSqlExecutor) => Promise<TResult>,
  ): Promise<TResult> {
    this.transactionCount += 1;
    return operation(this);
  }

  close(): Promise<void> {
    this.closeCount += 1;
    return Promise.resolve();
  }
}
