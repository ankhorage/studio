import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { appendStudioEventBinding, upsertStudioPropBinding } from './bindingAuthoringModel';

const button: UiNode = { id: 'button-1', type: 'Button' };

describe('binding mutation acceptance', () => {
  test('authors literal, state, context, and API capability property references', () => {
    const literal = upsertStudioPropBinding({}, button, 'children', {
      value: { kind: 'literal', value: 'Save' },
    });
    const state = upsertStudioPropBinding(literal, button, 'children', {
      value: { capability: 'state.draft.label' },
    });
    const context = upsertStudioPropBinding(state, button, 'children', {
      value: { capability: 'context.session.label' },
    });
    const operation = upsertStudioPropBinding(context, button, 'children', {
      value: {
        capability: 'api.catalog.items.read',
        path: 'title',
      },
    });

    expect(literal[button.id]?.props?.children?.value).toEqual({ kind: 'literal', value: 'Save' });
    expect(state[button.id]?.props?.children?.value).toEqual({ capability: 'state.draft.label' });
    expect(context[button.id]?.props?.children?.value).toEqual({
      capability: 'context.session.label',
    });
    expect(operation[button.id]?.props?.children?.value).toEqual({
      capability: 'api.catalog.items.read',
      path: 'title',
    });
  });

  test('authors static and dynamic capability event targets', () => {
    const withAction = appendStudioEventBinding({}, button, 'press', {
      target: {
        capability: 'navigator.navigate',
        input: { route: { kind: 'literal', value: '/done' } },
      },
    });
    const withOperation = appendStudioEventBinding(withAction, button, 'press', {
      target: {
        capability: 'api.catalog.items.create',
        input: { name: { capability: 'button.press', path: 'value' } },
      },
    });

    expect(
      withOperation[button.id]?.events?.press?.map((binding) => binding.target.capability),
    ).toEqual(['navigator.navigate', 'api.catalog.items.create']);
  });
});
