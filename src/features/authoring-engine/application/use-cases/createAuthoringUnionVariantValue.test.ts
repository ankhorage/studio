import { expect, test } from 'bun:test';

import type { AuthoringStructure } from '../../../../types/authoring-engine';
import { createAuthoringUnionVariantValue } from './createAuthoringUnionVariantValue';

const SHARED = {
  kind: 'object',
  fields: [
    { name: 'id', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
    {
      name: 'settings',
      optional: false,
      structure: {
        kind: 'object',
        fields: [
          { name: 'label', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
        ],
      },
    },
  ],
} as const satisfies AuthoringStructure;

const SOURCE = {
  kind: 'object',
  fields: [
    ...SHARED.fields,
    { name: 'kind', optional: false, structure: { kind: 'choice', values: ['basic'] } },
    { name: 'legacyOnly', optional: false, structure: { kind: 'scalar', scalarType: 'string' } },
  ],
} as const satisfies AuthoringStructure;

const TARGET = {
  kind: 'object',
  fields: [
    ...SHARED.fields,
    { name: 'kind', optional: false, structure: { kind: 'choice', values: ['advanced'] } },
    { name: 'advancedOnly', optional: false, structure: { kind: 'scalar', scalarType: 'number' } },
  ],
} as const satisfies AuthoringStructure;

test('preserves only structurally shared fields and takes the target discriminator', () => {
  expect(
    createAuthoringUnionVariantValue({
      currentValue: {
        id: 'stable',
        settings: { label: 'Keep me' },
        kind: 'basic',
        legacyOnly: 'drop me',
      },
      currentStructure: SOURCE,
      targetStructure: TARGET,
      discriminator: 'kind',
    }),
  ).toEqual({
    id: 'stable',
    settings: { label: 'Keep me' },
    kind: 'advanced',
    advancedOnly: 0,
  });
});

test('does not preserve a same-named field when its owner structure changes', () => {
  const changedTarget = {
    ...TARGET,
    fields: TARGET.fields.map((field) =>
      field.name === 'settings'
        ? {
            name: 'settings',
            optional: false,
            structure: { kind: 'scalar', scalarType: 'string' } as const,
          }
        : field,
    ),
  } satisfies AuthoringStructure;

  expect(
    createAuthoringUnionVariantValue({
      currentValue: {
        id: 'stable',
        settings: { label: 'Do not preserve' },
        kind: 'basic',
        legacyOnly: 'drop me',
      },
      currentStructure: SOURCE,
      targetStructure: changedTarget,
      discriminator: 'kind',
    }),
  ).toEqual({
    id: 'stable',
    settings: '',
    kind: 'advanced',
    advancedOnly: 0,
  });
});
