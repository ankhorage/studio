import type { DataSourceRegistry } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { collectDataSourceOperationRows } from './adminDataSourceOperations';

test('collects operations through data sources, endpoints, and operations', () => {
  const dataSources = {
    crm: {
      id: 'crm',
      kind: 'rest',
      baseUrl: 'https://api.example.test',
      endpoints: {
        contacts: {
          id: 'contacts',
          kind: 'http',
          path: '/contacts',
          operations: {
            'contacts.list': {
              id: 'contacts.list',
              protocol: 'http',
              intent: 'read',
              method: 'GET',
            },
            'contacts.create': {
              id: 'contacts.create',
              protocol: 'http',
              intent: 'create',
              method: 'POST',
            },
          },
        },
      },
    },
  } satisfies DataSourceRegistry;

  expect(collectDataSourceOperationRows(dataSources)).toEqual([
    {
      sourceId: 'crm',
      endpointId: 'contacts',
      operationId: 'contacts.list',
      kind: 'read',
      protocol: 'http',
    },
    {
      sourceId: 'crm',
      endpointId: 'contacts',
      operationId: 'contacts.create',
      kind: 'create',
      protocol: 'http',
    },
  ]);
});
