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
