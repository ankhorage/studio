import { describe, expect, test } from 'bun:test';

import { collectDataSourceOperationRows } from './adminDataSourceOperations';

describe('collectDataSourceOperationRows', () => {
  test('enumerates external and generated API operations uniformly', () => {
    const rows = collectDataSourceOperationRows({
      inventory: {
        id: 'inventory',
        kind: 'api',
        origin: 'external',
        protocol: 'rest',
        baseUrl: 'https://api.example.com',
        endpoints: {
          items: {
            id: 'items',
            kind: 'http',
            path: '/items',
            operations: {
              list: {
                id: 'list',
                name: 'List items',
                protocol: 'http',
                intent: 'read',
                method: 'GET',
              },
            },
          },
        },
      },
      catalog: {
        id: 'catalog',
        kind: 'api',
        origin: 'generated',
        protocol: 'rest',
        generatedApiId: 'catalog',
        adapter: { id: 'primary-db', kind: 'database' },
        endpoints: {
          products: {
            id: 'products',
            kind: 'database',
            path: '/products',
            operations: {
              'products.list': {
                id: 'products.list',
                endpointId: 'products',
                protocol: 'database',
                intent: 'read',
                path: '/products',
              },
            },
          },
        },
      },
    });

    expect(rows).toEqual([
      {
        sourceId: 'inventory',
        endpointId: 'items',
        operationId: 'list',
        name: 'List items',
        kind: 'read',
        protocol: 'http',
        method: 'GET',
        path: '/items',
        sourceOrigin: 'external',
        sourceProtocol: 'rest',
        testable: true,
      },
      {
        sourceId: 'catalog',
        endpointId: 'products',
        operationId: 'products.list',
        name: undefined,
        kind: 'read',
        protocol: 'database',
        method: null,
        path: '/products',
        sourceOrigin: 'generated',
        sourceProtocol: 'rest',
        testable: false,
      },
    ]);
  });
});
