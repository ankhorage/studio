import { describe, expect, test } from 'bun:test';

import type { StudioBindingInputFieldOption } from '../../../../bindingAuthoringModel';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';
import { createStudioEventBinding, createStudioEventInputDrafts } from './bindingEditorModel';

const requiredObjectField: StudioBindingInputFieldOption = {
  name: 'profile',
  label: 'Profile',
  value: { type: 'object' },
  required: true,
  authoring: {
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
  },
};

describe('binding editor model', () => {
  test('initializes required DataSchema-backed literals from neutral authoring semantics', () => {
    expect(createStudioEventInputDrafts([requiredObjectField], []).profile).toEqual({
      kind: 'literal',
      value: { name: '' },
      included: true,
    });
  });

  test('keeps optional literals omitted until explicitly selected or authored', () => {
    const optionalField: StudioBindingInputFieldOption = {
      ...requiredObjectField,
      required: false,
    };

    expect(createStudioEventInputDrafts([optionalField], []).profile).toEqual({
      kind: 'literal',
      value: { name: '' },
      included: false,
    });
    expect(createBindingLiteralDefaultValue(optionalField)).toEqual({ name: '' });
  });

  test('persists typed literal drafts without reparsing DataSchema-backed values', () => {
    const binding = createStudioEventBinding({
      target: {
        kind: 'operation',
        operation: { apiId: 'api', endpointId: 'profile', operationId: 'profile.update' },
      },
      fields: [requiredObjectField],
      drafts: {
        profile: {
          kind: 'literal',
          value: { name: 'Ada', enabled: true },
          included: true,
        },
      },
    });

    expect(binding.input?.profile).toEqual({
      kind: 'literal',
      value: { name: 'Ada', enabled: true },
    });
  });
});
