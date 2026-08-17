import type { ApiDefinitionList } from '@ankhorage/contracts/data';
import { expect, test } from 'bun:test';

import { collectApiOperationRows } from './adminApiOperations';

test('collects operations through canonical APIs, endpoints, and operations', () => {
  const apis: ApiDefinitionList = [
    {
      id: 'crm',
      origin: 'external',
      protocol: 'rest',
      baseUrl: 'https://api.example.test',
      endpoints: {
        contacts: {
          id: 'contacts',
          kind: 'http',
          path: '/contacts',
          operations: {
            'contacts.list': {
              id: 'contacts.list',
              endpointId: 'contacts',
              protocol: 'http',
              intent: 'read',
              method: 'GET',
              path: '/contacts',
            },
            'contacts.create': {
              id: 'contacts.create',
              endpointId: 'contacts',
              protocol: 'http',
              intent: 'create',
              method: 'POST',
              path: '/contacts',
            },
          },
        },
      },
    },
  ];

  expect(collectApiOperationRows(apis)).toEqual([
    {
      apiId: 'crm',
      endpointId: 'contacts',
      operationId: 'contacts.list',
      name: undefined,
      intent: 'read',
      protocol: 'http',
      method: 'GET',
      path: '/contacts',
      apiOrigin: 'external',
      apiProtocol: 'rest',
      testable: true,
    },
    {
      apiId: 'crm',
      endpointId: 'contacts',
      operationId: 'contacts.create',
      name: undefined,
      intent: 'create',
      protocol: 'http',
      method: 'POST',
      path: '/contacts',
      apiOrigin: 'external',
      apiProtocol: 'rest',
      testable: true,
    },
  ]);
});
