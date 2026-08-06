import { describe, expect, test } from 'bun:test';

import { collectDataSourceOperationRows } from './adminDataSourceOperations';

describe('collectDataSourceOperationRows', () => {
  test('lists canonical operation details for API administration', () => {
    const rows = collectDataSourceOperationRows({
      inventory: {
        id: 'inventory',
        kind: 'rest',
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
      },
    ]);
  });
});
