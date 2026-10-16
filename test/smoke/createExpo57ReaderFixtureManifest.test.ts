import { parseAppManifest } from '@ankhorage/contracts';
import { resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import type { ReaderProps } from '@ankhorage/zora';
import { ZORA_COMPONENT_META } from '@ankhorage/zora/metadata';
import { describe, expect, it } from 'bun:test';

import { createExpo57ReaderFixtureManifest } from './createExpo57ReaderFixtureManifest';

describe('createExpo57ReaderFixtureManifest', () => {
  it('is a canonical serializable manifest with EPUB and PDF routes', () => {
    const manifest = createExpo57ReaderFixtureManifest();

    expect(parseAppManifest(manifest)).toEqual({ ok: true, manifest });
    expect(manifest.navigator.routes).toEqual([
      { name: 'reader-epub', path: 'reader/epub', screenId: 'epub' },
      { name: 'reader-pdf', path: 'reader/pdf', screenId: 'pdf' },
    ]);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('plans the released standalone Reader dependency without permissions or Expo adapters', () => {
    const plan = resolveExpoRuntimePlan(createExpo57ReaderFixtureManifest());

    expect(plan.diagnostics).toEqual([]);
    expect(plan.permissions).toEqual([]);
    expect(plan.runtimeAdapters).toEqual([]);
    expect(plan.dependencies.map(({ name }) => name)).toEqual(['@ankhorage/reader']);
  });

  it('uses the public manifest node, file media reference, and normalized event bindings', () => {
    const manifest = createExpo57ReaderFixtureManifest();
    const reader = manifest.screens.epub?.root.children?.[0];
    const binding = manifest.dataBindings?.['reader-epub'];

    expect(ZORA_COMPONENT_META.Reader).toMatchObject({
      directManifestNode: true,
      requirements: { capabilities: { ebookReader: true } },
    });
    expect(reader).toMatchObject({
      id: 'reader-epub',
      props: { format: 'epub', source: { mediaId: 'reader-epub' } },
      type: 'Reader',
    });
    expect(binding?.events?.locationChange?.[0]?.target).toMatchObject({
      capability: 'action.console',
      input: {
        locator: { capability: 'event.reader.locationChange', path: 'payload.locator' },
        trigger: { capability: 'event.reader.locationChange', path: 'payload.trigger' },
      },
    });
    expect(binding?.events?.readerError?.[0]?.target).toMatchObject({
      capability: 'action.console',
      input: {
        code: { capability: 'event.reader.error', path: 'payload.code' },
        message: { capability: 'event.reader.error', path: 'payload.message' },
      },
    });
  });

  it('uses the standard ZORA interaction policy contract', () => {
    const props: Pick<ReaderProps, 'format' | 'source'> = {
      format: 'epub',
      source: { uri: 'https://example.test/reader.epub' },
    };

    expect(props.format).toBe('epub');
    expect(props.source).toEqual({ uri: 'https://example.test/reader.epub' });
  });
});
