import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { createStudioInstancePropertyPatch } from './propertiesAuthoringModel';

describe('instance Properties mutation model', () => {
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

  test('removes a property when the authoring engine emits unset', () => {
    const node: UiNode = {
      id: 'text',
      type: 'Text',
      props: { text: 'Hello', numberOfLines: 2 },
    };

    expect(createStudioInstancePropertyPatch(node, 'numberOfLines', undefined)).toEqual({
      props: { text: 'Hello' },
    });
  });

  test('preserves provider-neutral media references through the canonical node patch', () => {
    const node: UiNode = {
      id: 'image',
      type: 'Image',
      props: { alt: 'Mountain sunrise' },
    };

    expect(createStudioInstancePropertyPatch(node, 'source', { mediaId: 'hero-media' })).toEqual({
      props: { alt: 'Mountain sunrise', source: { mediaId: 'hero-media' } },
    });
  });
});
