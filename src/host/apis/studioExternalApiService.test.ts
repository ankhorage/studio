import type { ApiDefinition } from '@ankhorage/contracts/data';
import type {
  EndpointTestFetch,
  ExternalApiFetch,
  ExternalApiFetchResponse,
} from '@ankhorage/data-sources';
import { readOwnProperty } from '@ankhorage/utility/object';
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
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#3366ff', harmony: 'analogous' },
        dark: { primaryColor: '#6699ff', harmony: 'analogous' },
      },
    },
    activeThemeId: 'default',
    activeThemeMode: 'light',
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
        },
      },
      modules: {},
      apis: {},
    },
    ...overrides,
  } as StudioManifest;
}

function createProjectStore(initial = createManifest()) {
  let manifest = initial;
  return {
    manager: {
      getProjectManifest: () => Promise.resolve(manifest),
      persistProjectManifest: ({
        manifest: nextManifest,
      }: {
        readonly manifest: StudioManifest;
      }) => {
        manifest = nextManifest;
        return Promise.resolve(nextManifest);
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
  test('upserts one canonical OpenAPI entry without touching dataSources', async () => {
    const store = createProjectStore();
    const fetch: ExternalApiFetch = () => Promise.resolve(jsonResponse(openApiDocument()));
    const service = new StudioExternalApiService({
      projectManager: store.manager,
      discoveryFetch: fetch,
    });

    const first = await service.connect('demo', {
      apiId: 'Inventory API',
      url: 'https://api.example.com/openapi.json',
      protocol: 'openapi',
    });
    const second = await service.connect('demo', {
      apiId: 'Inventory API',
      url: 'https://api.example.com/openapi.json',
      protocol: 'openapi',
      name: 'Updated Inventory',
    });

    expect(first).toMatchObject({ ok: true, apiId: 'inventory-api', created: true });
    expect(second).toMatchObject({ ok: true, apiId: 'inventory-api', created: false });
    expect(Object.keys(store.read().infra.apis ?? {})).toHaveLength(1);
    expect(readApi(store.read(), 'inventory-api')).toMatchObject({
      id: 'inventory-api',
      origin: 'external',
      protocol: 'rest',
      name: 'Updated Inventory',
    });
    expect(store.read().dataSources).toEqual({});
  });

  test('persists GraphQL discovery directly in infra.apis', async () => {
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
      apiId: 'catalog',
      url: 'https://api.example.com/graphql',
      protocol: 'auto',
    });

    expect(result).toMatchObject({ ok: true, apiId: 'catalog', protocol: 'graphql' });
    expect(readApi(store.read(), 'catalog')).toMatchObject({
      id: 'catalog',
      origin: 'external',
      protocol: 'graphql',
      endpointUrl: 'https://api.example.com/graphql',
    });
    const catalog = readApi(store.read(), 'catalog');
    const graphql = catalog?.endpoints.graphql;
    expect(graphql ? readOwnProperty(graphql.operations, 'query.items') : undefined).toBeDefined();
  });

  test('creates manual REST APIs through the canonical owner helper', async () => {
    const store = createProjectStore();
    const service = new StudioExternalApiService({ projectManager: store.manager });

    const result = await service.createManualRest('demo', {
      apiId: 'inventory',
      baseUrl: 'https://api.example.com',
      endpointId: 'items',
      path: '/items',
      operationId: 'list-items',
      method: 'GET',
      intent: 'read',
    });

    expect(result).toMatchObject({ ok: true, apiId: 'inventory', protocol: 'rest' });
    const inventory = readApi(store.read(), 'inventory');
    const items = inventory?.endpoints.items;
    expect(items ? readOwnProperty(items.operations, 'list-items') : undefined).toMatchObject({
      method: 'GET',
      path: '/items',
    });
  });

  test('executes canonical external API operations over their remote URL', async () => {
    const store = createProjectStore(
      createManifest({
        infra: {
          environments: {
            local: {
              deployment: {
                compute: { provider: 'local' },
                runtime: { provider: 'minikube' },
              },
            },
          },
          modules: {},
          apis: {
            catalog: {
              id: 'catalog',
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
        },
      }),
    );
    let requestedUrl = '';
    let authorization = '';
    const endpointFetch: EndpointTestFetch = (url, init) => {
      requestedUrl = url;
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
      apiId: 'catalog',
      endpointId: 'items',
      operationId: 'list',
    });

    expect(requestedUrl).toBe('https://api.example.com/items');
    expect(authorization).toBe('Bearer trusted-token');
    expect(result).toMatchObject({ ok: true, response: { status: 200, ok: true } });
    expect(JSON.stringify(result)).not.toContain('trusted-token');
    expect(JSON.stringify(result)).not.toContain('authorization');
  });

  test('does not execute internal APIs in Phase 1', async () => {
    const store = createProjectStore(
      createManifest({
        infra: {
          environments: {
            local: {
              deployment: {
                compute: { provider: 'local' },
                runtime: { provider: 'minikube' },
              },
            },
          },
          modules: {},
          apis: {
            orders: {
              id: 'orders',
              origin: 'internal',
              protocol: 'rest',
              basePath: '/api/orders',
              endpoints: {},
            },
          },
        },
      }),
    );
    const service = new StudioExternalApiService({ projectManager: store.manager });

    const result = await service.testOperation('demo', {
      apiId: 'orders',
      endpointId: 'orders',
      operationId: 'list',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ apiId: 'orders', severity: 'error' });
  });
});


function readApi(manifest: StudioManifest, apiId: string): ApiDefinition | undefined {
  return manifest.infra.apis
    ? readOwnProperty<ApiDefinition>(manifest.infra.apis, apiId)
    : undefined;
}
