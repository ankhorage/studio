import type { StudioBindingInputFieldOption } from '../../../../bindingAuthoringModel';
import { describe, expect, test } from 'bun:test';

import {
  createStudioEventBinding,
  createStudioEventInputDrafts,
  type StudioEventInputDraft,
} from './bindingEditorModel';

const objectField: StudioBindingInputFieldOption = {
  name: 'payload',
  label: 'Payload',
  value: { type: 'object' },
  required: true,
  authoring: {
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
  },
};

describe('binding editor DataSchema drafts', () => {
  test('initializes typed literal values from neutral authoring semantics', () => {
    expect(createStudioEventInputDrafts([objectField], [])).toEqual({
      payload: {
        kind: 'literal',
        value: { count: 0 },
        authored: true,
      },
    });
  });

  test('prefers matching event payload paths over literal defaults', () => {
    expect(
      createStudioEventInputDrafts([objectField], [
        { path: 'payload', type: 'object' },
      ]),
    ).toEqual({
      payload: { kind: 'event', value: 'payload' },
    });
  });

  test('persists typed required literals and omits untouched optional literals', () => {
    const optionalField: StudioBindingInputFieldOption = {
      ...objectField,
      name: 'optionalPayload',
      required: false,
    };
    const drafts = createStudioEventInputDrafts([objectField, optionalField], []);
    const binding = createStudioEventBinding({
      target: {
        kind: 'operation',
        operation: { apiId: 'inventory', endpointId: 'items', operationId: 'items.create' },
      },
      fields: [objectField, optionalField],
      drafts,
    });

    expect(binding.input).toEqual({
      payload: { kind: 'literal', value: { count: 0 } },
    });
  });

  test('persists authored optional literals without stringifying structured values', () => {
    const optionalField: StudioBindingInputFieldOption = {
      ...objectField,
      name: 'optionalPayload',
      required: false,
    };
    const drafts: Readonly<Record<string, StudioEventInputDraft>> = {
      optionalPayload: {
        kind: 'literal',
        value: { count: 3, title: 'Ready' },
        authored: true,
      },
    };

    const binding = createStudioEventBinding({
      target: { kind: 'action', type: 'navigate' },
      fields: [optionalField],
      drafts,
    });

    expect(binding.input?.optionalPayload).toEqual({
      kind: 'literal',
      value: { count: 3, title: 'Ready' },
    });
  });
});
