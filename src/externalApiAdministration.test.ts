import type { ApiDefinitionList } from '@ankhorage/contracts/data';
import { describe, expect, test } from 'bun:test';

import { deriveExternalApiIdFromUrl } from './deriveExternalApiIdFromUrl';
import { removeExternalApi } from './removeExternalApi';

describe('external API administration model', () => {
  test('derives canonical ids from normalized URLs without scheme, query, or fragment', () => {
    expect(
      deriveExternalApiIdFromUrl('https://api.ankhorage.com/v1/poker/training/tasks?preview=1#schema'),
    ).toEqual({
      ok: true,
      apiId: 'api-ankhorage-com-v1-poker-training-tasks',
    });
    expect(deriveExternalApiIdFromUrl('HTTP://API.Example.com:8443/v1/Foo%20Bar/?x=1#top')).toEqual({
      ok: true,
      apiId: 'api-example-com-8443-v1-foo-bar',
    });
  });

  test('rejects values that are not HTTP or HTTPS API URLs', () => {
    expect(deriveExternalApiIdFromUrl('')).toEqual({
      ok: false,
      message: 'Enter a valid HTTP or HTTPS API URL.',
    });
    expect(deriveExternalApiIdFromUrl('ftp://api.example.com/v1')).toEqual({
      ok: false,
      message: 'Enter a valid HTTP or HTTPS API URL.',
    });
  });

  test('removes only the exact canonical API id', () => {
    const apis: ApiDefinitionList = [
      {
        id: 'inventory',
        origin: 'external',
        protocol: 'rest',
        baseUrl: 'https://api.example.com',
        endpoints: {},
      },
      {
        id: 'inventory-v2',
        origin: 'external',
        protocol: 'rest',
        baseUrl: 'https://api.example.com/v2',
        endpoints: {},
      },
    ];

    const removed = removeExternalApi(apis, 'inventory');
    expect(removed.removed).toBe(true);
    expect(removed.apis.map((api) => api.id)).toEqual(['inventory-v2']);

    const missing = removeExternalApi(removed.apis, 'inventory');
    expect(missing.removed).toBe(false);
    expect(missing.apis.map((api) => api.id)).toEqual(['inventory-v2']);
  });
});
