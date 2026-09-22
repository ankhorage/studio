import { expect, test } from 'bun:test';

import type { AuthoringStructure } from '../../../../types/authoring-engine';
import { deriveAuthoringModel } from './deriveAuthoringModel';

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
