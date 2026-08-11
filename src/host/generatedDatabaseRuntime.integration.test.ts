import type { GeneratedApiDefinition } from '@ankhorage/contracts';
import { createGeneratedApiDataSource } from '@ankhorage/data-sources';
import { createSupabaseDbAdapter } from '@ankhorage/supabase-db';
import { afterAll, expect, mock, test } from 'bun:test';

import {
  type GeneratedDatabaseRuntimeManifest,
  resolveGeneratedDatabaseRuntime,
} from './generatedDatabaseRuntime';

await mock.module('react-native', () => ({
  StyleSheet: {
    create<TStyles extends Record<string, unknown>>(styles: TStyles): TStyles {
      return styles;
    },
  },
  Text: () => null,
  View: () => null,
}));

afterAll(() => {
  mock.restore();
});

test('executes canonical generated create through the released Supabase DB adapter', async () => {
  const { createRuntimeDataSourceOperationExecutor } = await import('@ankhorage/runtime');
  const definition: GeneratedApiDefinition = {
    id: 'items-api',
    protocol: 'rest',
    basePath: '/api',
    database: { id: 'primary-db', kind: 'database' },
    resources: [
      {
        id: 'items',
        path: '/items',
        collection: {
          name: 'items',
          schema: 'public',
          primaryKey: 'id',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'name', type: 'text', required: true },
          ],
        },
        operations: ['create'],
      },
    ],
  };
  const manifest = {
    infra: { database: { provider: 'supabase', tier: 'dev' }, modules: [] },
    generatedApis: { [definition.id]: definition },
  } satisfies GeneratedDatabaseRuntimeManifest;
  const runtimeSelection = resolveGeneratedDatabaseRuntime(manifest);
  expect(runtimeSelection?.adapterIds).toEqual(['primary-db']);

  const normalized = createGeneratedApiDataSource(definition);
  if (!normalized.ok) throw new Error('Expected generated API fixture to normalize.');
  const endpoint = normalized.data.endpoints.items;
  if (!endpoint) throw new Error('Expected generated items endpoint.');

  const calls: { readonly method?: string; readonly url: string }[] = [];
  const mockedFetch = Object.assign(
    (
      input: string | URL | Request,
      init?: RequestInit | BunFetchRequestInit,
    ): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, method: init?.method });
      return Promise.resolve(
        new Response(JSON.stringify([{ id: 'item-1', name: 'Created' }]), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
    { preconnect: fetch.preconnect },
  ) satisfies typeof fetch;
  const adapter = createSupabaseDbAdapter({
    url: 'https://supabase.example.test',
    anonKey: 'anon-key',
    fetch: mockedFetch,
  });
  const executor = createRuntimeDataSourceOperationExecutor({
    databaseAdapters: { 'primary-db': adapter },
  });

  const result = await executor({
    dataSource: normalized.data,
    endpoint,
    input: { name: 'Created' },
    operation: {
      dataSourceId: definition.id,
      endpointId: 'items',
      operationId: 'items.create',
    },
  });

  expect(result).toEqual({
    ok: true,
    data: { id: 'item-1', name: 'Created' },
    diagnostics: [],
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toContain('https://supabase.example.test/rest/v1/items');
  expect(calls[0]?.method).toBe('POST');
});
