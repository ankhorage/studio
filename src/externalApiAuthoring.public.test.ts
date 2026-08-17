import { describe, expect, test } from 'bun:test';

import {
  type ExternalApiConnectRequest,
  type ExternalApiConnectResult,
  type ExternalApiDiscoveryAttempt,
  type ExternalApiIdResult,
  type ExternalApiOperationTestRequest,
  type ExternalApiOperationTestResult,
  type ExternalApiProtocol,
  type ExternalApiUpsertResult,
  type ManualRestApiRequest,
  normalizeExternalApiId,
  upsertExternalApi,
} from './externalApiAuthoring';

describe('external API authoring public model', () => {
  test('exports serializable canonical API authoring contracts', () => {
    const protocol: ExternalApiProtocol = 'auto';
    const request: ExternalApiConnectRequest = {
      apiId: 'inventory',
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
    const manualRequest: ManualRestApiRequest = {
      apiId: 'inventory',
      baseUrl: 'https://api.example.com',
      endpointId: 'items',
      path: '/items',
      operationId: 'list-items',
      method: 'GET',
      intent: 'read',
    };
    const testRequest: ExternalApiOperationTestRequest = {
      apiId: manualRequest.apiId,
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

  test('normalizes stable API IDs', () => {
    const result: ExternalApiIdResult = normalizeExternalApiId('  Inventory API / V1  ');
    expect(result).toEqual({
      ok: true,
      apiId: 'inventory-api-v1',
    });
    expect(normalizeExternalApiId('---')).toEqual({
      ok: false,
      message: 'API ID must contain at least one letter or number.',
    });
  });

  test('upserts canonical API lists without data-source projection', () => {
    const api = {
      id: 'inventory',
      origin: 'external',
      protocol: 'rest',
      baseUrl: 'https://api.example.com',
      endpoints: {},
    } as const;
    const created: ExternalApiUpsertResult = upsertExternalApi([], api);
    const updated = upsertExternalApi(created.apis, {
      ...api,
      name: 'Inventory',
    });

    expect(created.created).toBe(true);
    expect(updated.created).toBe(false);
    expect(updated.apis[0]?.name).toBe('Inventory');
  });
});
