import type { DataSchemaRegistry } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { resolveDataSchemaAuthoringStructure } from './resolveDataSchemaAuthoringStructure';

describe('resolveDataSchemaAuthoringStructure', () => {
  test('preserves primitive, finite-choice, object, and ordered-list semantics', () => {
    expect(resolveDataSchemaAuthoringStructure({ type: 'string' }, undefined)).toEqual({
      ok: true,
      structure: { kind: 'scalar', scalarType: 'string' },
    });
    expect(
      resolveDataSchemaAuthoringStructure({ enum: ['draft', 'published'] }, undefined),
    ).toEqual({
      ok: true,
      structure: { kind: 'choice', values: ['draft', 'published'] },
    });
    expect(
      resolveDataSchemaAuthoringStructure(
        {
          type: 'object',
          required: ['count'],
          properties: {
            title: { type: 'string' },
            count: { type: 'integer' },
          },
        },
        undefined,
      ),
    ).toMatchObject({
      ok: true,
      structure: {
        kind: 'object',
        fields: [
          {
            name: 'count',
            optional: false,
            structure: { kind: 'scalar', scalarType: 'integer' },
          },
          {
            name: 'title',
            optional: true,
            structure: { kind: 'scalar', scalarType: 'string' },
          },
        ],
      },
    });
    expect(
      resolveDataSchemaAuthoringStructure(
        { type: 'array', items: { type: 'string' } },
        undefined,
      ),
    ).toEqual({
      ok: true,
      structure: {
        kind: 'ordered-list',
        item: { kind: 'scalar', scalarType: 'string' },
      },
    });
  });

  test('resolves local refs and reports missing or recursive refs explicitly', () => {
    const schemas: DataSchemaRegistry = {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          manager: { ref: { id: 'user' } },
        },
      },
    };

    const resolved = resolveDataSchemaAuthoringStructure({ ref: { id: 'user' } }, schemas);
    expect(resolved.ok).toBe(true);
    if (resolved.ok && resolved.structure.kind === 'object') {
      expect(resolved.structure.fields.find((field) => field.name === 'name')?.structure).toEqual({
        kind: 'scalar',
        scalarType: 'string',
      });
      expect(resolved.structure.fields.find((field) => field.name === 'manager')?.structure).toMatchObject(
        {
          kind: 'unsupported',
          sourceKind: 'data-schema-recursive-ref',
          diagnostic: { code: 'unresolved-reference', path: ['manager'] },
        },
      );
    }

    expect(
      resolveDataSchemaAuthoringStructure({ ref: { id: 'missing' } }, schemas),
    ).toMatchObject({
      ok: true,
      structure: {
        kind: 'unsupported',
        sourceKind: 'data-schema-missing-ref',
        diagnostic: { code: 'unresolved-reference', path: [] },
      },
    });
  });

  test('fails closed for unions, dynamic records, complex choices, and nullable scalars', () => {
    expect(
      resolveDataSchemaAuthoringStructure(
        { oneOf: [{ type: 'string' }, { type: 'number' }] },
        undefined,
      ),
    ).toMatchObject({
      ok: true,
      structure: { kind: 'unsupported', sourceKind: 'data-schema-one-of' },
    });
    expect(
      resolveDataSchemaAuthoringStructure(
        { type: 'object', additionalProperties: { type: 'string' } },
        undefined,
      ),
    ).toMatchObject({
      ok: true,
      structure: {
        kind: 'unsupported',
        sourceKind: 'data-schema-additional-properties',
      },
    });
    expect(
      resolveDataSchemaAuthoringStructure({ enum: [{ id: 'a' }] }, undefined),
    ).toMatchObject({
      ok: true,
      structure: { kind: 'unsupported', sourceKind: 'data-schema-complex-choice' },
    });
    expect(
      resolveDataSchemaAuthoringStructure({ type: 'string', nullable: true }, undefined),
    ).toMatchObject({
      ok: true,
      structure: { kind: 'unsupported', sourceKind: 'data-schema-nullable' },
    });
  });
});
