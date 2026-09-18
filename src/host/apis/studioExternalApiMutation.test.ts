import type { ApiDefinition } from '@ankhorage/contracts/data';
import type { ExternalApiFetch, ExternalApiFetchResponse } from '@ankhorage/data-sources';
import { readOwnProperty } from '@ankhorage/utility/object';
import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from '../../index';
import { StudioExternalApiService } from './studioExternalApiService';

/*** Create the smallest current Studio manifest needed by external API mutation tests. */
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

/*** Create an in-memory canonical project store that exposes its latest persisted manifest. */
function createProjectStore(initial: StudioManifest) {
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

/*** Create a deterministic external API discovery response for failure-path tests. */
function jsonResponse(value: unknown, status: number): ExternalApiFetchResponse {
  return { status, text: () => Promise.resolve(JSON.stringify(value)) };
}

describe('StudioExternalApiService mutations', () => {
  test('updates manual REST settings in place while preserving authored operations', async () => {
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
            inventory: {
              id: 'inventory',
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
    const service = new StudioExternalApiService({ projectManager: store.manager });

    const result = await service.updateManualRestSettings('demo', {
      apiId: 'inventory',
      baseUrl: 'https://api-v2.example.com',
      name: 'Inventory v2',
      credential: { id: 'services/inventory', kind: 'bearer', scope: 'header:authorization' },
    });

    expect(result).toEqual({ ok: true, apiId: 'inventory', diagnostics: [] });
    expect(Object.keys(store.read().infra.apis ?? {})).toHaveLength(1);
    const inventory = readApi(store.read(), 'inventory');
    expect(inventory).toMatchObject({
      id: 'inventory',
      name: 'Inventory v2',
      baseUrl: 'https://api-v2.example.com',
      credential: {
        id: 'services/inventory',
        kind: 'bearer',
        scope: 'header:authorization',
      },
    });
    expect(inventory?.endpoints.items?.operations.list).toMatchObject({
      method: 'GET',
      path: '/items',
    });
  });

  test('removes only the requested external API id from canonical manifest state', async () => {
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
            inventory: {
              id: 'inventory',
              origin: 'external',
              protocol: 'rest',
              baseUrl: 'https://api.example.com',
              endpoints: {},
            },
            'inventory-v2': {
              id: 'inventory-v2',
              origin: 'external',
              protocol: 'rest',
              baseUrl: 'https://api.example.com/v2',
              endpoints: {},
            },
          },
        },
      }),
    );
    const service = new StudioExternalApiService({ projectManager: store.manager });

    const result = await service.remove('demo', { apiId: 'inventory' });

    expect(result).toEqual({ ok: true, apiId: 'inventory', diagnostics: [] });
    expect(Object.values(store.read().infra.apis ?? {}).map((api) => api.id)).toEqual(['inventory-v2']);
  });

  test('returns discovery diagnostics without persisting a second model when automatic discovery fails', async () => {
    const store = createProjectStore(createManifest());
    const fetch: ExternalApiFetch = () => Promise.resolve(jsonResponse({}, 404));
    const service = new StudioExternalApiService({
      projectManager: store.manager,
      discoveryFetch: fetch,
    });

    const result = await service.connect('demo', {
      apiId: 'missing',
      url: 'https://api.example.com/missing',
      protocol: 'auto',
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(store.read().infra.apis).toEqual({});
  });
});


function readApi(manifest: StudioManifest, apiId: string): ApiDefinition | undefined {
  return manifest.infra.apis
    ? readOwnProperty<ApiDefinition>(manifest.infra.apis, apiId)
    : undefined;
}
