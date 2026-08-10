import type {
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  PropBinding,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  appendStudioEventBinding,
  assessStudioBindingCompatibility,
  collectStudioBindingOperationOptions,
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
          payload: { eventType: 'button.press', fields: [] },
        },
      },
    },
    props: {
      children: { type: 'string', category: 'Content' },
      disabled: { type: 'boolean', category: 'State' },
    },
  },
};

const dataSources: DataSourceRegistry = {
  external: {
    id: 'external',
    kind: 'api',
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
  generated: {
    id: 'generated',
    kind: 'api',
    origin: 'generated',
    protocol: 'rest',
    generatedApiId: 'generated',
    adapter: { id: 'primary-db', kind: 'database' },
    endpoints: {
      items: {
        id: 'items',
        kind: 'database',
        operations: {
          'items.create': {
            id: 'items.create',
            protocol: 'database',
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
});

describe('binding registry mutations', () => {
  test('round-trips property and event bindings through the canonical registry', () => {
    const prop: PropBinding = { source: { kind: 'state', path: 'draft.name' } };
    const withProp = upsertStudioPropBinding({}, button, 'children', prop);
    const withEvent = appendStudioEventBinding(withProp, button, 'press', {
      target: { kind: 'action', type: 'navigate' },
      input: { route: { kind: 'literal', value: '/done' } },
    });
    const serialized = JSON.parse(JSON.stringify(withEvent)) as ComponentDataBindingRegistry;

    expect(serialized[button.id]?.props?.children).toEqual(prop);
    expect(serialized[button.id]?.events?.press?.[0]?.target).toEqual({
      kind: 'action',
      type: 'navigate',
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
  test('enumerates external and generated operations through one canonical model', () => {
    const options = collectStudioBindingOperationOptions(dataSources);
    expect(options.map((option) => option.operation.operationId).sort()).toEqual([
      'items.create',
      'profile.read',
    ]);
    const generated = options.find((option) => option.operation.operationId === 'items.create');
    const external = options.find((option) => option.operation.operationId === 'profile.read');

    expect(generated?.inputFields).toMatchObject([
      { name: 'name', required: true, value: { type: 'string' } },
      { name: 'count', required: false, value: { type: 'number' } },
    ]);
    expect(external?.responsePaths.map((entry) => entry.path)).toEqual(['', 'name', 'age']);
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
  test('diagnoses missing operations and incompatible response paths', () => {
    const operations = collectStudioBindingOperationOptions(dataSources);
    const missingRegistry = upsertStudioPropBinding({}, button, 'children', {
      source: {
        kind: 'operation',
        operation: { dataSourceId: 'missing', endpointId: 'x', operationId: 'x.read' },
      },
    });
    const incompatibleRegistry = upsertStudioPropBinding({}, button, 'children', {
      source: {
        kind: 'operation',
        operation: { dataSourceId: 'external', endpointId: 'profile', operationId: 'profile.read' },
        path: 'age',
      },
    });

    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry: missingRegistry,
        componentMeta,
        operations,
        actionTypes: ['navigate'],
      })[0]?.code,
    ).toBe('missing-operation');
    expect(
      diagnoseStudioComponentBindings({
        node: button,
        registry: incompatibleRegistry,
        componentMeta,
        operations,
        actionTypes: ['navigate'],
      })[0]?.code,
    ).toBe('incompatible-response');
  });
});
