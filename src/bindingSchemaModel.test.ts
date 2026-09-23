import { describe, expect, test } from 'bun:test';
import path from 'path';

import { resolveStudioSchemaValueMeta } from './bindingSchemaModel';

describe('resolveStudioSchemaValueMeta', () => {
  test('projects finite DataSchema choices through the canonical authoring structure', () => {
    expect(resolveStudioSchemaValueMeta({ enum: ['draft', 'published'] }, undefined)).toEqual({
      type: 'string',
    });
    expect(resolveStudioSchemaValueMeta({ const: 3 }, undefined)).toEqual({
      type: 'number',
    });
  });

  test('preserves binding-only format and record compatibility metadata', () => {
    expect(
      resolveStudioSchemaValueMeta({ type: 'string', format: 'date-time' }, undefined),
    ).toEqual({ type: 'date' });
    expect(
      resolveStudioSchemaValueMeta(
        { type: 'object', additionalProperties: { type: 'string' } },
        undefined,
      ),
    ).toEqual({ type: 'record' });
  });

  test('projects supported containers and fails closed when the authoring adapter rejects shape', () => {
    expect(
      resolveStudioSchemaValueMeta(
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        undefined,
      ),
    ).toEqual({
      type: 'object',
      fields: [
        { path: 'name', type: 'string', required: true },
        { path: 'tags', type: 'array', required: false },
      ],
    });
    expect(
      resolveStudioSchemaValueMeta({ type: 'array', items: { type: 'string' } }, undefined),
    ).toEqual({ type: 'array', itemType: 'string' });
    expect(
      resolveStudioSchemaValueMeta(
        { oneOf: [{ type: 'string' }, { type: 'number' }] },
        undefined,
      ),
    ).toEqual({ type: 'unknown' });
    expect(
      resolveStudioSchemaValueMeta({ type: 'string', nullable: true }, undefined),
    ).toEqual({ type: 'unknown' });
  });
});

test('binding schema compatibility projection does not maintain a second DataSchema shape interpreter', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'bindingSchemaModel.ts')).text();

  expect(source).toContain('resolveDataSchemaAuthoringStructure');
  expect(source).not.toContain('resolveSingleSchemaType');
  expect(source).not.toContain('function resolveSchemaType');
});
