import type { UiNode } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import type { StudioAuthoringMetaRegistry } from '../../../../propertiesAuthoringModel';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';
import { resolveInstancePropertyAuthoring } from './resolveInstancePropertyAuthoring';

const registry: StudioAuthoringMetaRegistry = {
  Heading: {
    name: 'Heading',
    props: {
      text: {
        type: 'string',
        category: 'Content',
        label: 'Text',
        default: 'Heading',
        authoring: { authority: 'instance' },
      },
      level: {
        type: 'enum',
        category: 'Semantics',
        label: 'Level',
        enum: [1, 2, 3, 4, 5, 6],
        default: 2,
        authoring: { authority: 'instance' },
      },
      size: {
        type: 'enum',
        category: 'Style',
        enum: ['h1', 'h2'],
        authoring: { authority: 'theme' },
      },
    },
  },
  Image: {
    name: 'Image',
    props: {
      source: {
        type: 'media',
        category: 'Content',
        label: 'Source',
        mediaKinds: ['image'],
        authoring: { authority: 'instance' },
      },
    },
  },
  List: {
    name: 'List',
    props: {
      items: {
        type: 'array',
        category: 'Data',
        label: 'Items',
        authoring: { authority: 'instance' },
      },
    },
  },
};

test('derives grouped instance fields and owner defaults without exposing theme authority', () => {
  const node: UiNode = { id: 'heading', type: 'Heading', props: { level: 3 } };
  const authoring = resolveInstancePropertyAuthoring(node, registry);

  expect(authoring.componentName).toBe('Heading');
  expect(authoring.groups.map((group) => group.category)).toEqual(['Content', 'Semantics']);
  expect(
    authoring.groups.flatMap((group) => group.structure.fields.map((field) => field.name)),
  ).toEqual(['text', 'level']);

  const [content, semantics] = authoring.groups;
  if (!content || !semantics) throw new Error('Expected grouped Heading authoring.');

  expect(
    deriveAuthoringModel({ ...content, value: node.props ?? {}, label: content.category }),
  ).toMatchObject({
    fields: [
      {
        path: ['text'],
        label: 'Text',
        value: undefined,
        inheritance: { value: 'Heading', overridden: false },
      },
    ],
  });
  expect(
    deriveAuthoringModel({ ...semantics, value: node.props ?? {}, label: semantics.category }),
  ).toMatchObject({
    fields: [
      {
        kind: 'choice',
        path: ['level'],
        values: [1, 2, 3, 4, 5, 6],
        value: 3,
        inheritance: { value: 2, overridden: true },
      },
    ],
  });
});

test('preserves media kinds as an owner-backed editor hint over portable reference structure', () => {
  const node: UiNode = {
    id: 'image',
    type: 'Image',
    props: { source: { mediaId: 'hero' } },
  };
  const authoring = resolveInstancePropertyAuthoring(node, registry);
  const [group] = authoring.groups;
  if (!group) throw new Error('Expected Image authoring.');

  const model = deriveAuthoringModel({ ...group, value: node.props ?? {}, label: group.category });
  expect(model).toMatchObject({
    fields: [
      {
        kind: 'object',
        path: ['source'],
        editor: { kind: 'media', mediaKinds: ['image'] },
      },
    ],
  });
});

test('keeps unsupported owner types explicit instead of guessing an editor', () => {
  const node: UiNode = { id: 'list', type: 'List', props: { items: [] } };
  const authoring = resolveInstancePropertyAuthoring(node, registry);
  const [group] = authoring.groups;
  if (!group) throw new Error('Expected List authoring.');

  const model = deriveAuthoringModel({ ...group, value: node.props ?? {}, label: group.category });
  expect(model).toMatchObject({
    fields: [
      {
        kind: 'unsupported',
        path: ['items'],
        diagnostic: {
          code: 'unsupported-structure',
          path: ['items'],
        },
      },
    ],
  });
});
