import { parseAppManifest } from '@ankhorage/contracts';
import { resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
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

  it('plans the released reader adapter and document dependencies without permissions', () => {
    const plan = resolveExpoRuntimePlan(createExpo57ReaderFixtureManifest());

    expect(plan.diagnostics).toEqual([]);
    expect(plan.permissions).toEqual([]);
    expect(plan.runtimeAdapters).toEqual(['ExpoReaderSurfaceAdapter']);
    expect(plan.dependencies.map(({ name }) => name)).toEqual([
      '@ankhorage/expo-runtime',
      '@readium/navigator',
      '@readium/shared',
      '@zip.js/zip.js',
      'pdfjs-dist',
    ]);
  });

  it('uses the public manifest node, file media reference, and normalized event bindings', () => {
    const manifest = createExpo57ReaderFixtureManifest();
    const reader = manifest.screens.epub?.root.children?.[0];
    const binding = manifest.dataBindings?.['reader-epub'];

    expect(ZORA_COMPONENT_META.ReaderSurface).toMatchObject({
      directManifestNode: true,
      requirements: { capabilities: [{ capability: 'ebookReader' }] },
    });
    expect(reader).toMatchObject({
      id: 'reader-epub',
      props: { format: 'epub', source: { mediaId: 'reader-epub' } },
      type: 'ReaderSurface',
    });
    expect(binding?.events?.locationChange?.[0]?.input).toMatchObject({
      locator: { kind: 'source', source: { kind: 'event', path: 'payload.locator' } },
      trigger: { kind: 'source', source: { kind: 'event', path: 'payload.trigger' } },
    });
    expect(binding?.events?.readerError?.[0]?.input).toMatchObject({
      code: { kind: 'source', source: { kind: 'event', path: 'payload.code' } },
      message: { kind: 'source', source: { kind: 'event', path: 'payload.message' } },
    });
  });
});
