import type { ApiDefinitionList } from '@ankhorage/contracts/data';
import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { collectApiOperationRows } from './adminApiOperations';

const pagesDirectory = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(pagesDirectory, 'ApisAdminPage.tsx'), 'utf8');
const connectSource = readFileSync(path.join(pagesDirectory, 'ExternalApiConnectCard.tsx'), 'utf8');
const catalogSource = readFileSync(path.join(pagesDirectory, 'ApiCatalogCard.tsx'), 'utf8');
const editSource = readFileSync(path.join(pagesDirectory, 'ExternalApiEditCard.tsx'), 'utf8');
const manualSource = readFileSync(path.join(pagesDirectory, 'ManualRestApiCard.tsx'), 'utf8');

test('keeps external API administration progressive and owner-backed', () => {
  expect(connectSource).toContain('deriveExternalApiIdFromUrl');
  expect(connectSource).toContain("protocol: 'auto'");
  expect(connectSource).toContain('Discover API');
  expect(connectSource).not.toContain('PROTOCOL_OPTIONS');
  expect(connectSource).not.toContain('setApiId');

  expect(pageSource).toContain('showAuthoring && fallback');
  expect(pageSource).toContain("const showOperations = routeId === 'api-operations';");
  expect(pageSource).toContain('ConfirmDialog');
  expect(pageSource).toContain('removeExternalApiConnection');
  expect(pageSource).toContain('accessibilityLiveRegion="polite"');

  expect(manualSource).toContain('Manual REST fallback');
  expect(manualSource).toContain('Retry discovery');
  expect(manualSource).toContain('attemptedUrl');

  expect(catalogSource).toContain('ListSection');
  expect(catalogSource).toContain('ListRow');
  expect(catalogSource).toContain('Badge');
  expect(catalogSource).toContain('Edit');
  expect(catalogSource).toContain('Remove');

  expect(editSource).toContain('Generated API ID');
  expect(editSource).toContain('Credential secret ref');
  expect(editSource).toContain('connectExternalApi');
  expect(editSource).toContain('updateManualRestApi');
  expect(editSource).toContain('Protocol discovery strategy');
});

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
