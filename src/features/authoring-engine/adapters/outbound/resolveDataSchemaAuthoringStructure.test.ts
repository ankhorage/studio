import type { DataSchemaRegistry } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { resolveDataSchemaAuthoringStructure } from './resolveDataSchemaAuthoringStructure';

describe('resolveDataSchemaAuthoringStructure', () => {
  test('preserves primitive, finite-choice, object, and ordered-array semantics', () => {
    expect(resolveDataSchemaAuthoringStructure({ type: 'integer' }, undefined)).toEqual({
      kind: 'scalar',
      scalarType: 'integer',
    });
    expect(
      resolveDataSchemaAuthoringStructure({ enum: ['draft', 'published'] }, undefined),
    ).toEqual({ kind: 'choice', values: ['draft', 'published'] });
    expect(
      resolveDataSchemaAuthoringStructure(
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            enabled: { type: 'boolean' },
          },
        },
        undefined,
      ),
    ).toEqual({
      kind: 'object',
      fields: [
        {
          name: 'name',
          optional: false,
          structure: { kind: 'scalar', scalarType: 'string' },
        },
        {
          name: 'enabled',
          optional: true,
          structure: { kind: 'scalar', scalarType: 'boolean' },
        },
      ],
    });
    expect(
      resolveDataSchemaAuthoringStructure(
        { type: 'array', items: { type: 'string' } },
        undefined,
      ),
    ).toEqual({
      kind: 'ordered-list',
      item: { kind: 'scalar', scalarType: 'string' },
    });
  });

  test('resolves owner schema references before deriving neutral structure', () => {
    const schemas: DataSchemaRegistry = {
      profile: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    };

    expect(resolveDataSchemaAuthoringStructure({ ref: { id: 'profile' } }, schemas)).toEqual({
      kind: 'object',
      fields: [
        {
          name: 'id',
          optional: false,
          structure: { kind: 'scalar', scalarType: 'string' },
        },
      ],
    });
  });

  test('keeps unsupported composition and dynamic-record semantics explicit', () => {
    const union = resolveDataSchemaAuthoringStructure(
      { oneOf: [{ type: 'string' }, { type: 'number' }] },
      undefined,
    );
    const record = resolveDataSchemaAuthoringStructure(
      { type: 'object', additionalProperties: { type: 'string' } },
      undefined,
    );
    const unresolved = resolveDataSchemaAuthoringStructure(
      { ref: { id: 'missing' } },
      {},
    );

    expect(union).toMatchObject({
      kind: 'unsupported',
      sourceKind: 'oneOf',
      diagnostic: { code: 'unsupported-structure' },
    });
    expect(record).toMatchObject({
      kind: 'unsupported',
      sourceKind: 'record',
      diagnostic: { code: 'unsupported-structure' },
    });
    expect(unresolved).toMatchObject({
      kind: 'unsupported',
      sourceKind: 'unresolved-ref',
      diagnostic: { code: 'unresolved-reference' },
    });
  });
});
