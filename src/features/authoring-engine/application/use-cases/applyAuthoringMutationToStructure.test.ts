import { expect, test } from 'bun:test';

import type { AuthoringStructure } from '../../../../types/authoring-engine';
import { applyAuthoringMutationToStructure } from './applyAuthoringMutationToStructure';

const THEME_TOKEN_STRUCTURE = {
  kind: 'object',
  fields: [
    { name: 'id', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
    {
      name: 'tokens',
      optional: true,
      structure: {
        kind: 'object',
        fields: [
          {
            name: 'spacing',
            optional: true,
            structure: {
              kind: 'value-map',
              key: { kind: 'scalar', scalarType: 'string' },
              value: { kind: 'scalar', scalarType: 'number' },
            },
          },
          {
            name: 'typography',
            optional: true,
            structure: {
              kind: 'object',
              fields: [
                {
                  name: 'headings',
                  optional: true,
                  structure: {
                    kind: 'value-map',
                    key: { kind: 'scalar', scalarType: 'string' },
                    value: {
                      kind: 'object',
                      fields: [
                        {
                          name: 'size',
                          optional: true,
                          structure: { kind: 'scalar', scalarType: 'number' },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as const satisfies AuthoringStructure;

test('materializes owner-approved optional parents for a new authored override', () => {
  const current: Readonly<Record<string, unknown>> = { id: 'theme' };
  const result = applyAuthoringMutationToStructure(current, THEME_TOKEN_STRUCTURE, {
    kind: 'set',
    path: ['tokens', 'spacing', 'm'],
    value: 16,
  });

  expect(result).toEqual({
    ok: true,
    value: { id: 'theme', tokens: { spacing: { m: 16 } } },
  });
});

test('prunes empty optional parent structures after resetting the last override', () => {
  const current: Readonly<Record<string, unknown>> = {
    id: 'theme',
    tokens: { spacing: { m: 16 } },
  };
  const result = applyAuthoringMutationToStructure(current, THEME_TOKEN_STRUCTURE, {
    kind: 'unset',
    path: ['tokens', 'spacing', 'm'],
  });

  expect(result).toEqual({ ok: true, value: { id: 'theme' } });
});

test('prunes empty object-valued map entries and their optional ancestors', () => {
  const current: Readonly<Record<string, unknown>> = {
    id: 'theme',
    tokens: { typography: { headings: { h1: { size: 32 } } } },
  };
  const result = applyAuthoringMutationToStructure(current, THEME_TOKEN_STRUCTURE, {
    kind: 'unset',
    path: ['tokens', 'typography', 'headings', 'h1', 'size'],
  });

  expect(result).toEqual({ ok: true, value: { id: 'theme' } });
});

test('preserves newly inserted empty object-valued map entries until they can be authored', () => {
  const current: Readonly<Record<string, unknown>> = {
    id: 'theme',
    tokens: { typography: { headings: {} } },
  };
  const result = applyAuthoringMutationToStructure(current, THEME_TOKEN_STRUCTURE, {
    kind: 'set',
    path: ['tokens', 'typography', 'headings', 'display'],
    value: {},
  });

  expect(result).toEqual({
    ok: true,
    value: {
      id: 'theme',
      tokens: { typography: { headings: { display: {} } } },
    },
  });
});

test('rejects value-map renames to owner-invalid keys', () => {
  const result = applyAuthoringMutationToStructure(
    { id: 'theme', tokens: { spacing: { m: 16 } } },
    THEME_TOKEN_STRUCTURE,
    {
      kind: 'rename-key',
      path: ['tokens', 'spacing'],
      fromKey: 'm',
      toKey: '',
    },
  );

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostic).toMatchObject({
    code: 'mutation-rejected',
    path: ['tokens', 'spacing'],
  });
});

test('rejects owner-unknown materialization paths', () => {
  const result = applyAuthoringMutationToStructure({ id: 'theme' }, THEME_TOKEN_STRUCTURE, {
    kind: 'set',
    path: ['tokens', 'unknown', 'x'],
    value: 1,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostic).toMatchObject({
    code: 'mutation-rejected',
    path: ['tokens', 'unknown', 'x'],
  });
});

const REGISTRY_STRUCTURE = {
  kind: 'object',
  fields: [
    {
      name: 'items',
      optional: false,
      structure: {
        kind: 'entity-registry',
        key: { kind: 'scalar', scalarType: 'string' },
        identityField: 'id',
        value: {
          kind: 'object',
          fields: [
            { name: 'id', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
            { name: 'name', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
          ],
        },
      },
    },
  ],
} as const satisfies AuthoringStructure;

const UNION_STRUCTURE = {
  kind: 'object',
  fields: [
    {
      name: 'rollout',
      optional: false,
      structure: {
        kind: 'union',
        discriminator: 'mode',
        variants: [
          {
            kind: 'object',
            fields: [
              {
                name: 'mode',
                optional: false,
                structure: { kind: 'choice', values: ['immediate'] },
              },
            ],
          },
          {
            kind: 'object',
            fields: [
              {
                name: 'mode',
                optional: false,
                structure: { kind: 'choice', values: ['staged'] },
              },
              {
                name: 'fraction',
                optional: false,
                structure: { kind: 'scalar', scalarType: 'string' },
              },
            ],
          },
        ],
      },
    },
  ],
} as const satisfies AuthoringStructure;

test('adds and removes stable registry entities by record identity', () => {
  const added = applyAuthoringMutationToStructure({ items: {} }, REGISTRY_STRUCTURE, {
    kind: 'set',
    path: ['items', 'alpha'],
    value: { id: 'alpha', name: 'Alpha' },
  });
  expect(added).toEqual({
    ok: true,
    value: { items: { alpha: { id: 'alpha', name: 'Alpha' } } },
  });
  if (!added.ok) return;

  expect(
    applyAuthoringMutationToStructure(added.value, REGISTRY_STRUCTURE, {
      kind: 'unset',
      path: ['items', 'alpha'],
    }),
  ).toEqual({ ok: true, value: { items: {} } });
});

test('rejects empty registry identity keys at the application boundary', () => {
  const result = applyAuthoringMutationToStructure({ items: {} }, REGISTRY_STRUCTURE, {
    kind: 'set',
    path: ['items', ''],
    value: { id: '', name: 'Invalid' },
  });

  expect(result).toMatchObject({
    ok: false,
    diagnostic: { code: 'mutation-rejected' },
  });
});

test('rejects registry identity-field mutation and mismatched inserted identity', () => {
  const current = { items: { alpha: { id: 'alpha', name: 'Alpha' } } };
  const identityMutation = applyAuthoringMutationToStructure(current, REGISTRY_STRUCTURE, {
    kind: 'set',
    path: ['items', 'alpha', 'id'],
    value: 'other',
  });
  expect(identityMutation).toMatchObject({
    ok: false,
    diagnostic: { code: 'mutation-rejected' },
  });

  const mismatchedInsert = applyAuthoringMutationToStructure(current, REGISTRY_STRUCTURE, {
    kind: 'set',
    path: ['items', 'beta'],
    value: { id: 'other', name: 'Beta' },
  });
  expect(mismatchedInsert).toMatchObject({
    ok: false,
    diagnostic: { code: 'mutation-rejected', path: ['items', 'beta', 'id'] },
  });
});

test('switches discriminated union variants and edits only the active variant', () => {
  const current: Readonly<Record<string, unknown>> = { rollout: { mode: 'immediate' } };
  const switched = applyAuthoringMutationToStructure(current, UNION_STRUCTURE, {
    kind: 'set',
    path: ['rollout'],
    value: { mode: 'staged', fraction: '0.25' },
  });
  expect(switched).toEqual({
    ok: true,
    value: { rollout: { mode: 'staged', fraction: '0.25' } },
  });
  if (!switched.ok) return;

  expect(
    applyAuthoringMutationToStructure(switched.value, UNION_STRUCTURE, {
      kind: 'set',
      path: ['rollout', 'fraction'],
      value: '0.5',
    }),
  ).toEqual({
    ok: true,
    value: { rollout: { mode: 'staged', fraction: '0.5' } },
  });
});

test('rejects nested edits when the current union discriminator is unknown', () => {
  const result = applyAuthoringMutationToStructure(
    { rollout: { mode: 'unknown' } },
    UNION_STRUCTURE,
    {
      kind: 'set',
      path: ['rollout', 'fraction'],
      value: '0.5',
    },
  );

  expect(result).toMatchObject({
    ok: false,
    diagnostic: { code: 'mutation-rejected' },
  });
});
