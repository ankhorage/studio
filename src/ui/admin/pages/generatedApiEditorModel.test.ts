import { describe, expect, test } from 'bun:test';

import {
  createGeneratedApiEditorDraft,
  resolveGeneratedApiEditorDraft,
} from './generatedApiEditorModel';

describe('generated API editor model', () => {
  test('round-trips fields, CRUD selection, defaults, and seeds', () => {
    const draft = createGeneratedApiEditorDraft();
    const [resource] = draft.resources;
    if (!resource) throw new Error('Expected default resource.');

    const [idField] = resource.fields;
    if (!idField) throw new Error('Expected default field.');

    const result = resolveGeneratedApiEditorDraft({
      ...draft,
      id: 'inventory',
      basePath: '/api/inventory',
      resources: [
        {
          ...resource,
          id: 'items',
          collectionName: 'items',
          operations: ['list', 'create'],
          fields: [
            { ...idField, name: 'id' },
            {
              name: 'price',
              type: 'number',
              required: true,
              unique: false,
              defaultValueText: '12.5',
            },
          ],
          seedText: '[{"id":"00000000-0000-0000-0000-000000000001","price":9.5}]',
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.definition?.resources[0]).toMatchObject({
      operations: ['list', 'create'],
      collection: {
        name: 'items',
        primaryKey: 'id',
        fields: [
          { name: 'id', type: 'uuid', required: true, unique: true },
          { name: 'price', type: 'number', required: true, defaultValue: 12.5 },
        ],
      },
      seed: [{ id: '00000000-0000-0000-0000-000000000001', price: 9.5 }],
    });
    expect(result.dataSource?.endpoints.items?.operations['items.list']).toBeDefined();
    expect(result.dataSource?.endpoints.items?.operations['items.create']).toBeDefined();
  });

  test('surfaces canonical field diagnostics from Data Sources', () => {
    const draft = createGeneratedApiEditorDraft();
    const [resource] = draft.resources;
    if (!resource) throw new Error('Expected default resource.');

    const [field] = resource.fields;
    if (!field) throw new Error('Expected default field.');

    const result = resolveGeneratedApiEditorDraft({
      ...draft,
      id: 'broken-fields',
      resources: [
        {
          ...resource,
          fields: [field, { ...field }],
        },
      ],
    });

    expect(result.diagnostics.map((entry) => entry.path)).toContain(
      'resources.items.collection.fields.1.name',
    );
  });

  test('returns structured diagnostics for invalid seed JSON and primary keys', () => {
    const draft = createGeneratedApiEditorDraft();
    const [resource] = draft.resources;
    if (!resource) throw new Error('Expected default resource.');

    const result = resolveGeneratedApiEditorDraft({
      ...draft,
      id: 'broken',
      resources: [{ ...resource, primaryKey: 'missing', seedText: '{ nope' }],
    });

    expect(result.diagnostics.map((entry) => entry.path)).toContain(
      'resources.items.collection.primaryKey',
    );
    expect(result.diagnostics.map((entry) => entry.path)).toContain('resources.0.seed');
  });
});
