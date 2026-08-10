import type { ComponentDataBindingRegistry } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { updateStudioManifestDraftDataBindings } from './core/studioManifestDraftModel';
import type { StudioManifest } from './index';
import { createStudioManifestSignature } from './manifestSync';

function createManifest(): StudioManifest {
  return {
    navigator: { type: 'stack', routes: [] },
    screens: {},
    dataSources: {},
    themes: [],
    activeThemeId: 'default',
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [] },
  } as unknown as StudioManifest;
}

describe('binding manifest persistence', () => {
  test('round-trips canonical data bindings through the manifest draft and signature', () => {
    const registry: ComponentDataBindingRegistry = {
      'button-1': {
        componentId: 'button-1',
        componentType: 'Button',
        props: {
          children: { source: { kind: 'context', path: 'session.user.name' } },
        },
        events: {
          press: [
            {
              target: { kind: 'action', type: 'navigate' },
              input: { route: { kind: 'literal', value: '/done' } },
            },
          ],
        },
      },
    };
    const next = updateStudioManifestDraftDataBindings(createManifest(), registry);
    const serialized = JSON.parse(JSON.stringify(next)) as StudioManifest;

    expect(serialized.dataBindings).toEqual(registry);
    expect(createStudioManifestSignature(serialized)).toBe(createStudioManifestSignature(next));
  });
});
