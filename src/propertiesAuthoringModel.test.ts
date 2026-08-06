import type { UiNode } from '@ankhorage/contracts';
import { ZORA_COMPONENT_META } from '@ankhorage/zora/metadata';
import { describe, expect, test } from 'bun:test';

import {
  createStudioInstancePropertyPatch,
  resolveStudioInstancePropertyFields,
  resolveStudioInstancePropertyGroups,
  type StudioAuthoringMetaRegistry,
} from './index';

const registry: StudioAuthoringMetaRegistry = {
  Button: {
    name: 'Button',
    props: {
      children: {
        type: 'string',
        category: 'Content',
        label: 'Label',
        default: 'Continue',
        authoring: { authority: 'instance' },
      },
      variant: {
        type: 'enum',
        category: 'Style',
        enum: ['solid', 'outline'],
        authoring: { authority: 'theme' },
      },
      internalState: {
        type: 'string',
        category: 'Internal',
      },
    },
  },
  Text: {
    name: 'Text',
    props: {
      text: {
        type: 'string',
        category: 'Content',
        authoring: { authority: 'instance' },
      },
      numberOfLines: {
        type: 'number',
        category: 'Layout',
        label: 'Line clamp',
        authoring: { authority: 'instance' },
      },
    },
  },
};

describe('instance Properties authoring model', () => {
  test('exposes only instance-authorable fields', () => {
    const node: UiNode = {
      id: 'button',
      type: 'Button',
      props: { children: 'Save', variant: 'outline', internalState: 'busy' },
    };

    const fields = resolveStudioInstancePropertyFields(node, registry);

    expect(fields).toEqual([
      {
        name: 'children',
        label: 'Label',
        category: 'Content',
        schemaType: 'string',
        editor: 'text',
        options: [],
        value: 'Save',
        defaultValue: 'Continue',
        isExplicit: true,
      },
    ]);
  });

  test('uses metadata defaults without persisting them as explicit node values', () => {
    const node: UiNode = { id: 'button', type: 'Button', props: {} };

    expect(resolveStudioInstancePropertyFields(node, registry)[0]).toMatchObject({
      name: 'children',
      value: 'Continue',
      isExplicit: false,
    });
  });

  test('preserves metadata order while grouping fields', () => {
    const node: UiNode = {
      id: 'text',
      type: 'Text',
      props: { text: 'Hello', numberOfLines: 2 },
    };

    expect(resolveStudioInstancePropertyGroups(node, registry)).toEqual([
      {
        category: 'Content',
        fields: [expect.objectContaining({ name: 'text', editor: 'text' })],
      },
      {
        category: 'Layout',
        fields: [expect.objectContaining({ name: 'numberOfLines', editor: 'number' })],
      },
    ]);
  });

  test('returns no fields for unknown components', () => {
    const node: UiNode = { id: 'unknown', type: 'Unknown', props: { title: 'Hidden' } };

    expect(resolveStudioInstancePropertyFields(node, registry)).toEqual([]);
  });

  test('updates one prop without mutating siblings', () => {
    const node: UiNode = {
      id: 'button',
      type: 'Button',
      props: { children: 'Save', trackingId: 'checkout' },
    };

    expect(createStudioInstancePropertyPatch(node, 'children', 'Continue')).toEqual({
      props: { trackingId: 'checkout', children: 'Continue' },
    });
    expect(node.props).toEqual({ children: 'Save', trackingId: 'checkout' });
  });

  test('removes an optional prop when the editor clears it', () => {
    const node: UiNode = {
      id: 'text',
      type: 'Text',
      props: { text: 'Hello', numberOfLines: 2 },
    };

    expect(createStudioInstancePropertyPatch(node, 'numberOfLines', undefined)).toEqual({
      props: { text: 'Hello' },
    });
  });

  test('consumes released ZORA Heading metadata without exposing theme presentation', () => {
    const node: UiNode = {
      id: 'heading',
      type: 'Heading',
      props: {
        text: 'Overview',
        level: 3,
        size: 'h1',
        color: 'accent',
        numberOfLines: 2,
      },
    };

    const fields = resolveStudioInstancePropertyFields(node, ZORA_COMPONENT_META);

    expect(fields.map((field) => field.name)).toEqual([
      'text',
      'i18nKey',
      'level',
      'numberOfLines',
    ]);
    expect(fields.find((field) => field.name === 'level')).toMatchObject({
      editor: 'choice',
      options: [1, 2, 3, 4, 5, 6],
      value: 3,
      defaultValue: 2,
      isExplicit: true,
    });
    expect(fields.some((field) => field.name === 'size')).toBe(false);
    expect(fields.some((field) => field.name === 'color')).toBe(false);
  });
});
