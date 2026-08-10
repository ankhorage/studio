import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { appendStudioEventBinding, upsertStudioPropBinding } from './bindingAuthoringModel';

const button: UiNode = { id: 'button-1', type: 'Button' };

describe('binding mutation acceptance', () => {
  test('authors literal, state, context, and operation property sources', () => {
    const literal = upsertStudioPropBinding({}, button, 'children', {
      source: { kind: 'literal', value: 'Save' },
    });
    const state = upsertStudioPropBinding(literal, button, 'children', {
      source: { kind: 'state', path: 'draft.label' },
    });
    const context = upsertStudioPropBinding(state, button, 'children', {
      source: { kind: 'context', path: 'session.label' },
    });
    const operation = upsertStudioPropBinding(context, button, 'children', {
      source: {
        kind: 'operation',
        operation: { dataSourceId: 'catalog', endpointId: 'items', operationId: 'items.read' },
        path: 'title',
      },
    });

    expect(literal[button.id]?.props?.children?.source.kind).toBe('literal');
    expect(state[button.id]?.props?.children?.source.kind).toBe('state');
    expect(context[button.id]?.props?.children?.source.kind).toBe('context');
    expect(operation[button.id]?.props?.children?.source.kind).toBe('operation');
  });

  test('authors action and operation event targets', () => {
    const withAction = appendStudioEventBinding({}, button, 'press', {
      target: { kind: 'action', type: 'navigate' },
      input: { route: { kind: 'literal', value: '/done' } },
    });
    const withOperation = appendStudioEventBinding(withAction, button, 'press', {
      target: {
        kind: 'operation',
        operation: { dataSourceId: 'generated', endpointId: 'items', operationId: 'items.create' },
      },
      input: {
        name: { kind: 'source', source: { kind: 'event', path: 'value' } },
      },
    });

    expect(withOperation[button.id]?.events?.press?.map((binding) => binding.target.kind)).toEqual([
      'action',
      'operation',
    ]);
  });
});
