import { describe, expect, test } from 'bun:test';

import {
  normalizeExternalApiSourceId,
  upsertExternalApiDataSource,
  type ExternalApiConnectRequest,
  type ExternalApiConnectResult,
  type ExternalApiDataSourceUpsertResult,
  type ExternalApiDiscoveryAttempt,
  type ExternalApiOperationTestRequest,
  type ExternalApiOperationTestResult,
  type ExternalApiProtocol,
  type ExternalApiSourceIdResult,
  type ManualRestSourceRequest,
} from './externalApiAuthoring';

describe('external API authoring public model', () => {
  test('exports serializable authoring contracts', () => {
    const protocol: ExternalApiProtocol = 'auto';
    const request: ExternalApiConnectRequest = {
      sourceId: 'inventory',
      url: 'https://api.example.com',
      protocol,
    };
    const attempt: ExternalApiDiscoveryAttempt = {
      url: request.url,
      outcome: 'matched',
      status: 200,
    };
    const connectResult: ExternalApiConnectResult = {
      ok: false,
      attempts: [attempt],
      diagnostics: [],
    };
    const manualRequest: ManualRestSourceRequest = {
      sourceId: 'inventory',
      baseUrl: 'https://api.example.com',
      endpointId: 'items',
      path: '/items',
      operationId: 'list-items',
      method: 'GET',
      intent: 'read',
    };
    const testRequest: ExternalApiOperationTestRequest = {
      sourceId: manualRequest.sourceId,
      endpointId: manualRequest.endpointId,
      operationId: manualRequest.operationId,
      dryRun: true,
    };
    const testResult: ExternalApiOperationTestResult = {
      ok: false,
      diagnostics: [],
    };

    expect({ request, connectResult, manualRequest, testRequest, testResult }).toBeDefined();
  });

  test('normalizes stable source IDs', () => {
    const result: ExternalApiSourceIdResult = normalizeExternalApiSourceId(
      '  Inventory API / V1  ',
    );
    expect(result).toEqual({
      ok: true,
      sourceId: 'inventory-api-v1',
    });
    expect(normalizeExternalApiSourceId('---')).toEqual({
      ok: false,
      message: 'Data-source ID must contain at least one letter or number.',
    });
  });

  test('upserts canonical data-source registries without parallel catalog state', () => {
    const source = {
      id: 'inventory',
      kind: 'rest',
      baseUrl: 'https://api.example.com',
      endpoints: {},
    } as const;
    const created: ExternalApiDataSourceUpsertResult = upsertExternalApiDataSource({}, source);
    const updated = upsertExternalApiDataSource(created.registry, {
      ...source,
      name: 'Inventory',
    });

    expect(created.created).toBe(true);
    expect(updated.created).toBe(false);
    expect(updated.registry.inventory?.name).toBe('Inventory');
  });
});
