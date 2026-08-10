import type {
  EndpointTestFetch,
  ExternalApiFetch,
  ExternalApiFetchResponse,
} from '@ankhorage/data-sources';
import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from '../../index';
import { StudioExternalApiService } from './studioExternalApiService';

function createManifest(overrides: Partial<StudioManifest> = {}): StudioManifest {
  return {
    navigator: { type: 'stack', routes: [{ name: 'home', screenId: 'home' }] },
    screens: {
      home: {
        id: 'home',
        name: 'Home',
        title: 'Home',
        root: { id: 'home-root', type: 'Screen', props: {} },
      },
    },
    dataBindings: {},
    dataSources: {},
    themes: [],
    activeThemeId: '',
    activeThemeMode: 'light',
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [], modulesConfig: {} },
    ...overrides,
  } as StudioManifest;
}

function createProjectStore(initial = createManifest()) {
  let manifest = initial;
  return {
    manager: {
      getProjectManifest: () => Promise.resolve(manifest),
      getStudioManifest: () => Promise.resolve(manifest),
      saveStudioManifest: (args: { readonly manifest: StudioManifest }) => {
        const { manifest: nextManifest } = args;
        manifest = nextManifest;
        return Promise.resolve({ success: true });
      },
    },
    read: () => manifest,
  };
}

function jsonResponse(value: unknown, status = 200): ExternalApiFetchResponse {
  return { status, text: () => Promise.resolve(JSON.stringify(value)) };
}

function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'Inventory', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/items': {
        get: {
          operationId: 'listItems',
          responses: { '200': { description: 'Items' } },
        },
      },
    },
  } as const;
}

function graphQlPayload() {
  return {
    data: {
      __schema: {
        queryType: { name: 'Query' },
        mutationType: null,
        subscriptionType: null,
        types: [
          {
            kind: 'OBJECT',
            name: 'Query',
            fields: [
              {
                name: 'items',
                args: [],
                type: { kind: 'LIST', name: null, ofType: { kind: 'SCALAR', name: 'String' } },
              },
            ],
          },
        ],
      },
    },
  } as const;
}

describe('StudioExternalApiService', () => {
  test('discovers and persists OpenAPI sources canonically', async () => {
    const store = createProjectStore();
    const fetch: ExternalApiFetch = () => Promise.resolve(jsonResponse(openApiDocument()));
    const service = new StudioExternalApiService({
      projectManager: store.manager,
      discoveryFetch: fetch,
    });

    const first = await service.connect('demo', {
      sourceId: 'Inventory API',
      url: 'https://api.example.com/openapi.json',
      protocol: 'openapi',
    });
    const second = await service.connect('demo', {
      sourceId: 'Inventory API',
      url: 'https://api.example.com/openapi.json',
      protocol: 'openapi',
      name: 'Updated Inventory',
    });

    expect(first).toMatchObject({ ok: true, sourceId: 'inventory-api', created: true });
    expect(second).toMatchObject({ ok: true, sourceId: 'inventory-api', created: false });
    expect(store.read().dataSources?.['inventory-api']).toMatchObject({
      kind: 'api',
      origin: 'external',
      protocol: 'rest',
    });
    expect(store.read().dataSources?.['inventory-api']?.name).toBe('Updated Inventory');
  });

  test('falls back from OpenAPI discovery to GraphQL introspection in auto mode', async () => {
    const store = createProjectStore();
    const fetch: ExternalApiFetch = (_url, init) =>
      Promise.resolve(
        init.method === 'POST' ? jsonResponse(graphQlPayload()) : jsonResponse({}, 404),
      );
    const service = new StudioExternalApiService({
      projectManager: store.manager,
      discoveryFetch: fetch,
    });

    const result = await service.connect('demo', {
      sourceId: 'catalog',
      url: 'https://api.example.com/graphql',
      protocol: 'auto',
    });

    expect(result).toMatchObject({ ok: true, protocol: 'graphql' });
    expect(
      store.read().dataSources?.catalog?.endpoints.graphql?.operations['query.items'],
    ).toBeDefined();
  });

  test('creates manual REST sources through the canonical owner helper', async () => {
    const store = createProjectStore();
    const service = new StudioExternalApiService({ projectManager: store.manager });

    const result = await service.createManualRest('demo', {
      sourceId: 'legacy',
      baseUrl: 'https://api.example.com',
      endpointId: 'items',
      path: '/items',
      operationId: 'list-items',
      method: 'GET',
      intent: 'read',
    });

    expect(result).toMatchObject({ ok: true, protocol: 'rest' });
    expect(
      store.read().dataSources?.legacy?.endpoints.items?.operations['list-items'],
    ).toMatchObject({
      method: 'GET',
      path: '/items',
    });
  });

  test('executes credential-backed operations without returning trusted values', async () => {
    const store = createProjectStore(
      createManifest({
        dataSources: {
          catalog: {
            id: 'catalog',
            kind: 'api',
            origin: 'external',
            protocol: 'rest',
            baseUrl: 'https://api.example.com',
            credential: { id: 'services/catalog', kind: 'bearer' },
            endpoints: {
              items: {
                id: 'items',
                kind: 'http',
                path: '/items',
                operations: {
                  list: {
                    id: 'list',
                    protocol: 'http',
                    intent: 'read',
                    method: 'GET',
                    path: '/items',
                  },
                },
              },
            },
          },
        },
      }),
    );
    let authorization = '';
    const endpointFetch: EndpointTestFetch = (_url, init) => {
      authorization = init.headers.authorization ?? '';
      return Promise.resolve(jsonResponse({ items: [] }));
    };
    const secretService = {
      resolve: () => Promise.resolve({ ok: true as const, data: { token: 'trusted-token' } }),
    };
    const service = new StudioExternalApiService({
      projectManager: store.manager,
      endpointFetch,
      secretService,
    });

    const result = await service.testOperation('demo', {
      sourceId: 'catalog',
      endpointId: 'items',
      operationId: 'list',
    });

    expect(authorization).toBe('Bearer trusted-token');
    expect(result).toMatchObject({ ok: true, response: { status: 200, ok: true } });
    expect(JSON.stringify(result)).not.toContain('trusted-token');
    expect(JSON.stringify(result)).not.toContain('authorization');
  });
});
