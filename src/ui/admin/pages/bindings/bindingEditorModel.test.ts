import { describe, expect, test } from 'bun:test';

import type { ApiDefinitionRegistry } from '@ankhorage/contracts';

import {
  collectStudioBindingCapabilityOptions,
  type StudioBindingInputFieldOption,
} from '../../../../bindingAuthoringModel';
import {
  createStudioEventBinding,
  createStudioEventInputDrafts,
  createStudioPropBindingForSource,
} from './bindingEditorModel';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';

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
  test('does not create a property binding when API result has no configured API', () => {
    expect(createStudioPropBindingForSource('api', { type: 'string' }, [])).toBeUndefined();
  });

  test('selects the configured API result capability for one or many API options', () => {
    const single = collectStudioBindingCapabilityOptions(createApis(['profile.read']));
    const multiple = collectStudioBindingCapabilityOptions(
      createApis(['profile.read', 'profile.update']),
    );

    expect(createStudioPropBindingForSource('api', { type: 'string' }, single)).toMatchObject({
      value: { capability: 'api.profile.profile.read', path: '' },
    });
    expect(createStudioPropBindingForSource('api', { type: 'string' }, multiple)).toMatchObject({
      value: { capability: 'api.profile.profile.read', path: '' },
    });
  });

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
        capability: 'api.api.profile.update',
      },
      eventCapability: 'profile.submit',
      fields: [requiredObjectField],
      drafts: {
        profile: {
          kind: 'literal',
          value: { name: 'Ada', enabled: true },
          included: true,
        },
      },
    });

    expect(binding.target.input?.profile).toEqual({
      kind: 'literal',
      value: { name: 'Ada', enabled: true },
    });
  });
});

/*** Create deterministic API definitions for property-source selection tests. */
function createApis(operationIds: readonly string[]): ApiDefinitionRegistry {
  return {
    profile: {
      id: 'profile',
      origin: 'external',
      protocol: 'rest',
      baseUrl: 'https://example.test',
      endpoints: {
        profile: {
          id: 'profile',
          kind: 'http',
          operations: Object.fromEntries(
            operationIds.map((id) => [
              id,
              {
                id,
                kind: 'http',
                protocol: 'http',
                intent: 'read',
                response: { schema: { type: 'string' } },
              },
            ]),
          ),
        },
      },
    },
  };
}
