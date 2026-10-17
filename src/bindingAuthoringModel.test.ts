import type {
  ApiDefinitionRegistry,
  ComponentDataBindingRegistry,
  EventBinding,
  PropBinding,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';
import { ZORA_COMPONENT_META } from '@ankhorage/zora/metadata';
import { describe, expect, test } from 'bun:test';

import {
  appendStudioEventBinding,
  assessStudioBindingCompatibility,
  collectStudioBindingCapabilityOptions,
  diagnoseStudioComponentBindings,
  removeStudioEventBinding,
  removeStudioPropBinding,
  resolveStudioBindableEvents,
  resolveStudioBindableProps,
  upsertStudioPropBinding,
} from './bindingAuthoringModel';

const button: UiNode = { id: 'button-1', type: 'Button', props: { children: 'Save' } };
const componentMeta: UiComponentMetaRegistry = {
  Button: {
    name: 'Button',
    category: 'component',
    directManifestNode: true,
    allowedChildren: [],
    bindings: {
      props: {
        children: {
          label: 'Label',
          value: { type: 'string' },
          acceptsFallback: true,
          acceptsTransforms: true,
        },
        disabled: {
          label: 'Disabled',
          value: { type: 'boolean' },
          acceptsFallback: true,
          acceptsTransforms: true,
        },
      },
      events: {
        press: {
          label: 'Press',
          payload: { eventType: 'button.press', fields: [{ path: 'value', type: 'string' }] },
        },
      },
    },
    props: {
      children: { type: 'string', category: 'Content' },
      disabled: { type: 'boolean', category: 'State' },
    },
  },
};

const apis: ApiDefinitionRegistry = {
  external: {
    id: 'external',
    origin: 'external',
    protocol: 'rest',
    baseUrl: 'https://example.test',
    endpoints: {
      profile: {
        id: 'profile',
        kind: 'http',
        operations: {
          'profile.read': {
            id: 'profile.read',
            protocol: 'http',
            intent: 'read',
            response: {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' }, age: { type: 'number' } },
              },
            },
          },
        },
      },
    },
  },
  inventory: {
    id: 'inventory',
    origin: 'external',
    protocol: 'rest',
    baseUrl: 'https://inventory.example.test',
    endpoints: {
      items: {
        id: 'items',
        kind: 'http',
        operations: {
          'items.create': {
            id: 'items.create',
            protocol: 'http',
            intent: 'create',
            request: {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string' }, count: { type: 'integer' } },
              },
            },
            response: {
              schema: {
                type: 'object',
                properties: { id: { type: 'string' }, name: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
};

describe('binding authoring metadata', () => {
  test('derives only explicitly bindable props and events from component metadata', () => {
    expect(resolveStudioBindableProps(button, componentMeta).map((entry) => entry.name)).toEqual([
      'children',
      'disabled',
    ]);
    expect(resolveStudioBindableEvents(button, componentMeta).map((entry) => entry.name)).toEqual([
      'press',
    ]);
  });

  test('derives ChessBoard props and events from released core ZORA metadata', () => {
    const chessBoard: UiNode = { id: 'chess-board', type: 'ChessBoard' };

    const propNames = resolveStudioBindableProps(chessBoard, ZORA_COMPONENT_META).map(
      (entry) => entry.name,
    );
    for (const propName of [
      'pieces',
      'orientation',
      'selectedSquare',
      'legalTargets',
      'disabled',
    ]) {
      expect(propNames).toContain(propName);
    }

    const eventNames = resolveStudioBindableEvents(chessBoard, ZORA_COMPONENT_META).map(
      (entry) => entry.name,
    );
    expect(eventNames).toContain('squarePress');
    expect(eventNames).toContain('moveAttempt');
  });
});

describe('binding registry mutations', () => {
  test('round-trips property and event bindings through the canonical registry', () => {
    const prop: PropBinding = { value: { capability: 'state.draft.name' } };
    const withProp = upsertStudioPropBinding({}, button, 'children', prop);
    const withEvent = appendStudioEventBinding(withProp, button, 'press', {
      target: {
        capability: 'navigator.navigate',
        input: { route: { kind: 'literal', value: '/done' } },
      },
    });
    const serialized = JSON.parse(JSON.stringify(withEvent)) as ComponentDataBindingRegistry;

    expect(serialized[button.id]?.props?.children).toEqual(prop);
    expect(serialized[button.id]?.events?.press?.[0]?.target).toEqual({
      capability: 'navigator.navigate',
      input: { route: { kind: 'literal', value: '/done' } },
    });
    expect(
      removeStudioEventBinding(
        removeStudioPropBinding(serialized, button, 'children'),
        button,
        'press',
        0,
      ),
    ).toEqual({});
  });
});

describe('binding operations and schemas', () => {
  test('enumerates canonical API operations without data-source projection', () => {
    const options = collectStudioBindingCapabilityOptions(apis);
    expect(
      options
        .filter((option) => option.capability.id.startsWith('api.'))
        .map((option) => option.capability.id)
        .sort(),
    ).toEqual(['api.external.profile.read', 'api.inventory.items.create']);
    const inventory = options.find(
      (option) => option.capability.id === 'api.inventory.items.create',
    );
    const external = options.find((option) => option.capability.id === 'api.external.profile.read');

    expect(inventory?.inputFields).toMatchObject([
      { name: 'name', required: true, value: { type: 'string' } },
      { name: 'count', required: false, value: { type: 'number' } },
    ]);
    expect(external?.responsePaths.map((entry) => entry.path)).toEqual(['', 'name', 'age']);
  });

  test('enumerates the first item and its nested fields for array operation responses', () => {
    const listApis: ApiDefinitionRegistry = {
      poker: {
        id: 'poker',
        origin: 'external',
        protocol: 'rest',
        baseUrl: 'https://api.example.test',
        endpoints: {
          tasks: {
            id: 'tasks',
            kind: 'http',
            operations: {
              'tasks.list': {
                id: 'tasks.list',
                protocol: 'http',
                intent: 'read',
                response: {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        communityCards: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              rank: { type: 'string' },
                              suit: { type: 'string' },
                            },
                          },
                        },
                        prompt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const operation = collectStudioBindingCapabilityOptions(listApis).find(
      (option) => option.capability.id === 'api.poker.tasks.list',
    );

    expect(operation?.responsePaths.map((entry) => entry.path)).toEqual([
      '',
      '0',
      '0.communityCards',
      '0.communityCards.0',
      '0.communityCards.0.rank',
      '0.communityCards.0.suit',
      '0.prompt',
    ]);
  });

  test('reports meaningful schema compatibility', () => {
    expect(assessStudioBindingCompatibility({ type: 'string' }, { type: 'string' })).toBe(
      'compatible',
    );
    expect(assessStudioBindingCompatibility({ type: 'number' }, { type: 'string' })).toBe(
      'incompatible',
    );
    expect(assessStudioBindingCompatibility({ type: 'record' }, { type: 'object' })).toBe(
      'compatible',
    );
  });
});

describe('binding diagnostics', () => {
  test('accepts runtime state and context property references without resolving executable capabilities', () => {
    const registry = {
      [button.id]: {
        componentId: button.id,
        props: {
          children: { value: { capability: 'state.draft.name' } },
          disabled: { value: { capability: 'context.session.controls.disabled' } },
        },
      },
    } satisfies ComponentDataBindingRegistry;

    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry,
        componentMeta,
        capabilities: collectStudioBindingCapabilityOptions({}),
      }),
    ).toEqual([]);
  });

  test('diagnoses incomplete state and context property references before their paths are authored', () => {
    const registry = {
      [button.id]: {
        componentId: button.id,
        props: {
          children: { value: { capability: 'state.' } },
          disabled: { value: { capability: 'context. ' } },
        },
      },
    } satisfies ComponentDataBindingRegistry;

    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry,
        componentMeta,
        capabilities: collectStudioBindingCapabilityOptions({}),
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'missing-capability-reference',
        path: 'props.children',
      }),
      expect.objectContaining({
        code: 'missing-capability-reference',
        path: 'props.disabled',
      }),
    ]);
  });

  test('diagnoses missing operations and incompatible response paths', () => {
    const capabilities = collectStudioBindingCapabilityOptions(apis);
    const missingRegistry = upsertStudioPropBinding({}, button, 'children', {
      value: {
        capability: 'api.missing.x.read',
      },
    });
    const incompatibleRegistry = upsertStudioPropBinding({}, button, 'children', {
      value: {
        capability: 'api.external.profile.read',
        path: 'age',
      },
    });

    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry: missingRegistry,
        componentMeta,
        capabilities,
      })[0]?.code,
    ).toBe('missing-capability');
    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry: incompatibleRegistry,
        componentMeta,
        capabilities,
      })[0]?.code,
    ).toBe('incompatible-response');
  });

  test('validates event capability ownership and payload paths', () => {
    const capabilities = collectStudioBindingCapabilityOptions({});
    const diagnostics = (input: EventBinding['target']['input']) =>
      diagnoseStudioComponentBindings({
        node: button,
        registry: {
          [button.id]: {
            componentId: button.id,
            events: {
              press: [{ target: { capability: 'navigator.navigate', input } }],
            },
          },
        },
        componentMeta,
        capabilities,
      });

    expect(diagnostics({ route: { capability: 'button.press', path: 'value' } })).toEqual([]);
    expect(
      diagnostics({ route: { capability: 'button.release', path: 'value' } })[0],
    ).toMatchObject({ code: 'incompatible-input', path: 'events.press.0.target.input.route' });
    expect(
      diagnostics({ route: { capability: 'button.press', path: 'unknown.path' } })[0],
    ).toMatchObject({ code: 'incompatible-input', path: 'events.press.0.target.input.route' });
  });

  test('diagnoses event input bindings when the event has no payload metadata', () => {
    const buttonMeta = componentMeta.Button;
    if (!buttonMeta) throw new Error('Button metadata fixture is missing.');
    const componentMetaWithoutEventPayload: UiComponentMetaRegistry = {
      ...componentMeta,
      Button: {
        ...buttonMeta,
        bindings: {
          ...buttonMeta.bindings,
          events: { press: { label: 'Press' } },
        },
      },
    };

    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry: {
          [button.id]: {
            componentId: button.id,
            events: {
              press: [
                {
                  target: {
                    capability: 'navigator.navigate',
                    input: { route: { capability: 'button.press', path: 'value' } },
                  },
                },
              ],
            },
          },
        },
        componentMeta: componentMetaWithoutEventPayload,
        capabilities: collectStudioBindingCapabilityOptions({}),
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'missing-event-payload-meta',
        path: 'events.press.0.target.input.route',
      }),
    ]);
  });
});
