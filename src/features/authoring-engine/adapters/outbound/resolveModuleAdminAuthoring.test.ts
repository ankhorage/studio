import { expect, test } from 'bun:test';

import type { StudioModuleAdminContribution } from '../../../../moduleAdminContracts';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';
import { resolveModuleAdminAuthoring } from './resolveModuleAdminAuthoring';

const contribution: StudioModuleAdminContribution = {
  kind: 'config-schema',
  title: 'Example',
  description: 'Package-owned configuration',
  fields: [
    { key: 'name', label: 'Name', control: 'text', required: true },
    { key: 'tags', label: 'Tags', control: 'string-list', required: true },
    { key: 'metadata', label: 'Metadata', control: 'structured-json', required: false },
  ],
};

test('adapts exercised module config controls to the neutral authoring model', () => {
  const authoring = resolveModuleAdminAuthoring(contribution);

  expect(authoring.structure).toEqual({
    kind: 'object',
    fields: [
      {
        name: 'name',
        optional: false,
        structure: { kind: 'scalar', scalarType: 'string' },
      },
      {
        name: 'tags',
        optional: false,
        structure: {
          kind: 'ordered-list',
          item: { kind: 'scalar', scalarType: 'string' },
        },
      },
      {
        name: 'metadata',
        optional: true,
        structure: {
          kind: 'unsupported',
          sourceKind: 'module-control:structured-json',
          diagnostic: {
            code: 'unsupported-structure',
            message:
              'Module admin control "structured-json" does not have a central Authoring Engine adapter.',
            path: ['metadata'],
          },
        },
      },
    ],
  });
  expect(authoring.policy).toEqual({
    label: 'Example',
    description: 'Package-owned configuration',
    fields: {
      name: { label: 'Name' },
      tags: { label: 'Tags' },
      metadata: { label: 'Metadata' },
    },
  });
});

test('preserves unsupported module controls as explicit authoring diagnostics', () => {
  const model = deriveAuthoringModel({
    ...resolveModuleAdminAuthoring(contribution),
    value: { name: 'Example', tags: ['mobile', 'public'], metadata: { retries: 3 } },
  });

  expect(model.kind).toBe('object');
  if (model.kind !== 'object') return;

  expect(model.fields.map((field) => [field.label, field.kind])).toEqual([
    ['Name', 'scalar'],
    ['Tags', 'ordered-list'],
    ['Metadata', 'unsupported'],
  ]);
  expect(model.fields[2]).toMatchObject({
    kind: 'unsupported',
    diagnostic: {
      code: 'unsupported-structure',
      path: ['metadata'],
    },
  });
});
