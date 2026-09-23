import { expect, test } from 'bun:test';

import type { AuthoringStructure } from '../../../../types/authoring-engine';
import { deriveAuthoringModel } from './deriveAuthoringModel';

test('derives a selected owner substructure at its canonical base path', () => {
  const model = deriveAuthoringModel({
    structure: { kind: 'scalar', scalarType: 'string' },
    value: undefined,
    path: ['tokens', 'weights', 'body'],
    optional: true,
    policy: { inheritance: { value: '400' } },
  });

  expect(model).toMatchObject({
    kind: 'scalar',
    path: ['tokens', 'weights', 'body'],
    optional: true,
    value: undefined,
    inheritance: { value: '400', overridden: false },
  });
});

test('derives scalar and optional fields from one neutral object structure', () => {
  const model = deriveAuthoringModel({
    structure: SCREEN_METADATA_STRUCTURE,
    value: {
      id: 'screen-home',
      name: 'Home',
      description: 'Landing screen',
    },
    policy: {
      label: 'Screen metadata',
      fields: {
        id: { readOnly: true, label: 'Stable screen ID' },
        description: { multiline: true },
      },
    },
  });

  expect(model.kind).toBe('object');
  if (model.kind !== 'object') return;

  expect(
    model.fields.map((field) => ({
      label: field.label,
      kind: field.kind,
      optional: field.optional,
      readOnly: field.readOnly,
      multiline: field.kind === 'scalar' ? field.multiline : undefined,
      value: field.kind === 'scalar' || field.kind === 'choice' ? field.value : undefined,
    })),
  ).toEqual([
    {
      label: 'Stable screen ID',
      kind: 'scalar',
      optional: false,
      readOnly: true,
      multiline: false,
      value: 'screen-home',
    },
    {
      label: 'Name',
      kind: 'scalar',
      optional: false,
      readOnly: false,
      multiline: false,
      value: 'Home',
    },
    {
      label: 'Title',
      kind: 'scalar',
      optional: true,
      readOnly: false,
      multiline: false,
      value: undefined,
    },
    {
      label: 'Description',
      kind: 'scalar',
      optional: true,
      readOnly: false,
      multiline: true,
      value: 'Landing screen',
    },
  ]);
});

test('derives finite string set membership without imposing order on persisted membership', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'set',
      member: { kind: 'choice', values: ['camera', 'microphone', 'notifications'] },
    },
    value: { notifications: true, camera: true },
  });

  expect(model).toMatchObject({
    kind: 'set',
    values: ['camera', 'microphone', 'notifications'],
    selected: ['camera', 'notifications'],
  });
});

test('derives ordered finite choices without sorting or deduplicating authored items', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'ordered-list',
      item: { kind: 'choice', values: ['email', 'phone', 'username'] },
    },
    value: ['username', 'email', 'username'],
  });

  expect(model).toMatchObject({
    kind: 'ordered-list',
    item: { kind: 'choice', values: ['email', 'phone', 'username'] },
    items: ['username', 'email', 'username'],
  });
});

test('derives ordered scalar string items without imposing a finite owner catalog', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'ordered-list',
      item: { kind: 'scalar', scalarType: 'string' },
    },
    value: ['email', 'custom-profile-id', 'email'],
  });

  expect(model).toMatchObject({
    kind: 'ordered-list',
    item: { kind: 'scalar', scalarType: 'string' },
    items: ['email', 'custom-profile-id', 'email'],
  });
});

test('rejects non-string runtime items for ordered scalar string lists', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'ordered-list',
      item: { kind: 'scalar', scalarType: 'string' },
    },
    value: ['email', 42],
  });

  expect(model).toMatchObject({
    kind: 'unsupported',
    diagnostic: { code: 'invalid-value' },
  });
});

test('rejects ordered-list values outside the owner choices', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'ordered-list',
      item: { kind: 'choice', values: ['email', 'phone'] },
    },
    value: ['email', 'username'],
  });

  expect(model).toMatchObject({
    kind: 'unsupported',
    diagnostic: { code: 'invalid-value' },
  });
});

test('rejects malformed or unknown set members instead of silently dropping them', () => {
  for (const value of [{ camera: false }, { unknown: true }]) {
    const model = deriveAuthoringModel({
      structure: {
        kind: 'set',
        member: { kind: 'choice', values: ['camera', 'microphone'] },
      },
      value,
    });

    expect(model).toMatchObject({
      kind: 'unsupported',
      diagnostic: { code: 'invalid-value' },
    });
  }
});

test('derives value-map entries by key identity with recursively authored values', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'value-map',
      key: { kind: 'scalar', scalarType: 'string' },
      value: {
        kind: 'object',
        fields: [
          { name: 'size', optional: false, structure: { kind: 'scalar', scalarType: 'number' } },
        ],
      },
    },
    value: { hero: { size: 32 }, body: { size: 16 } },
  });

  expect(model).toMatchObject({
    kind: 'value-map',
    key: { kind: 'scalar', scalarType: 'string' },
    entries: [
      { key: 'body', value: { kind: 'object', path: ['body'] } },
      { key: 'hero', value: { kind: 'object', path: ['hero'] } },
    ],
  });
});

test('merges inherited value-map keys without materializing them as authored state', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'value-map',
      key: { kind: 'scalar', scalarType: 'string' },
      value: { kind: 'scalar', scalarType: 'number' },
    },
    value: { m: 20 },
    policy: {
      fields: {
        s: { inheritance: { value: 8 } },
        m: { inheritance: { value: 16 } },
      },
    },
  });

  expect(model).toMatchObject({
    kind: 'value-map',
    entries: [
      {
        key: 'm',
        authored: true,
        value: {
          kind: 'scalar',
          value: 20,
          optional: true,
          inheritance: { value: 16, overridden: true },
        },
      },
      {
        key: 's',
        authored: false,
        value: {
          kind: 'scalar',
          value: undefined,
          optional: true,
          inheritance: { value: 8, overridden: false },
        },
      },
    ],
  });
});

test('rejects non-object runtime values for value maps', () => {
  const model = deriveAuthoringModel({
    structure: {
      kind: 'value-map',
      key: { kind: 'scalar', scalarType: 'string' },
      value: { kind: 'scalar', scalarType: 'number' },
    },
    value: ['not-a-map'],
  });

  expect(model).toMatchObject({
    kind: 'unsupported',
    diagnostic: { code: 'invalid-value' },
  });
});

test('reports invalid runtime values instead of coercing them', () => {
  const model = deriveAuthoringModel({
    structure: { kind: 'scalar', scalarType: 'boolean' },
    value: 'yes',
  });

  expect(model.kind).toBe('unsupported');
  if (model.kind !== 'unsupported') return;
  expect(model.diagnostic.code).toBe('invalid-value');
});

const SCREEN_METADATA_STRUCTURE = {
  kind: 'object',
  fields: [
    { name: 'id', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
    { name: 'name', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
    { name: 'title', optional: true, structure: { kind: 'scalar', scalarType: 'string' } },
    {
      name: 'description',
      optional: true,
      structure: { kind: 'scalar', scalarType: 'string' },
    },
  ],
} as const satisfies AuthoringStructure;
