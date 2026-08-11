import type { GeneratedApiDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { deleteStudioGeneratedApi, upsertStudioGeneratedApi } from './generatedApiAuthoring';
import type { StudioManifest } from './index';

const definition: GeneratedApiDefinition = {
  id: 'inventory',
  protocol: 'rest',
  basePath: '/api/inventory',
  database: { id: 'primary-db', kind: 'database' },
  resources: [
    {
      id: 'items',
      path: '/items',
      collection: {
        name: 'items',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'name', type: 'text', required: true, unique: true },
        ],
      },
      operations: ['list', 'read', 'create', 'update', 'delete'],
      seed: [{ id: '00000000-0000-0000-0000-000000000001', name: 'First' }],
    },
  ],
};

function createManifest(): StudioManifest {
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    themes: [],
    activeThemeId: 'default',
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}

describe('generated API authoring mutations', () => {
  test('persists desired state and its normalized projection together', () => {
    const result = upsertStudioGeneratedApi(createManifest(), definition);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.generatedApis?.inventory).toEqual(definition);
    expect(result.manifest.dataSources?.inventory).toMatchObject({
      id: 'inventory',
      kind: 'api',
      origin: 'generated',
      protocol: 'rest',
      generatedApiId: 'inventory',
      adapter: { id: 'primary-db', kind: 'database' },
    });
    expect(
      result.manifest.dataSources?.inventory?.endpoints.items?.operations['items.list'],
    ).toMatchObject({ protocol: 'database', intent: 'read' });
  });

  test('renames and deletes only the generated projection it owns', () => {
    const created = upsertStudioGeneratedApi(createManifest(), definition);
    if (!created.ok) throw new Error('Expected fixture to be valid.');

    const renamed = upsertStudioGeneratedApi(
      created.manifest,
      { ...definition, id: 'catalog' },
      'inventory',
    );
    if (!renamed.ok) throw new Error('Expected rename to be valid.');

    expect(renamed.manifest.generatedApis?.inventory).toBeUndefined();
    expect(renamed.manifest.dataSources?.inventory).toBeUndefined();
    expect(renamed.manifest.generatedApis?.catalog?.id).toBe('catalog');
    expect(
      deleteStudioGeneratedApi(renamed.manifest, 'catalog').dataSources?.catalog,
    ).toBeUndefined();
  });

  test('refuses to overwrite an external source with the same ID', () => {
    const manifest = createManifest();
    const result = upsertStudioGeneratedApi(
      {
        ...manifest,
        dataSources: {
          inventory: {
            id: 'inventory',
            kind: 'api',
            origin: 'external',
            protocol: 'rest',
            baseUrl: 'https://api.example.test',
            endpoints: {},
          },
        },
      },
      definition,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('duplicate-data-source-id');
  });
});
