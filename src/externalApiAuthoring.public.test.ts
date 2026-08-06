import { describe, expect, test } from 'bun:test';

import {
  normalizeExternalApiSourceId,
  upsertExternalApiDataSource,
} from './externalApiAuthoring';

describe('external API authoring public model', () => {
  test('normalizes stable source IDs', () => {
    expect(normalizeExternalApiSourceId('  Inventory API / V1  ')).toEqual({
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
    const created = upsertExternalApiDataSource({}, source);
    const updated = upsertExternalApiDataSource(created.registry, {
      ...source,
      name: 'Inventory',
    });

    expect(created.created).toBe(true);
    expect(updated.created).toBe(false);
    expect(updated.registry.inventory?.name).toBe('Inventory');
  });
});
