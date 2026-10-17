import { parseAppManifest, type ComponentEventDto } from '@ankhorage/contracts';
import { resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { resolveRuntimeBindingExpressionSync } from '@ankhorage/runtime/bindings';
import type { ReaderProps } from '@ankhorage/zora';
import { CAPABILITIES as ZORA_CAPABILITIES } from '@ankhorage/zora/capabilities';
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

  it('uses the public manifest node and file media reference without an unowned action target', () => {
    const manifest = createExpo57ReaderFixtureManifest();
    const reader = manifest.screens.epub?.root.children?.[0];

    expect(ZORA_COMPONENT_META.Reader).toMatchObject({
      directManifestNode: true,
      requirements: { capabilities: { ebookReader: true } },
    });
    expect(reader).toMatchObject({
      id: 'reader-epub',
      props: { format: 'epub', source: { mediaId: 'reader-epub' } },
      type: 'Reader',
    });
    expect(manifest.dataBindings).toBeUndefined();
    expect(ZORA_CAPABILITIES.some(({ id }) => id === 'action.console')).toBe(false);
  });

  it('resolves reader event payloads through the Runtime 5 capability resolver', () => {
    const locationEvent = {
      payload: {
        locator: 'epubcfi(/6/4!/4/2)',
        trigger: 'swipe',
      },
      sourceNodeId: 'reader-epub',
      type: 'reader.locationChange',
    } as const satisfies ComponentEventDto<'reader.locationChange', object>;
    const errorEvent = {
      payload: {
        code: 'protected-document',
        message: 'This document cannot be opened.',
      },
      sourceNodeId: 'reader-epub',
      type: 'reader.error',
    } as const satisfies ComponentEventDto<'reader.error', object>;

    expect(
      resolveRuntimeBindingExpressionSync(
        { capability: 'reader.locationChange', path: 'payload.locator' },
        { event: locationEvent },
      ),
    ).toBe('epubcfi(/6/4!/4/2)');
    expect(
      resolveRuntimeBindingExpressionSync(
        { capability: 'reader.locationChange', path: 'payload.trigger' },
        { event: locationEvent },
      ),
    ).toBe('swipe');
    expect(
      resolveRuntimeBindingExpressionSync(
        { capability: 'reader.error', path: 'payload.code' },
        { event: errorEvent },
      ),
    ).toBe('protected-document');
    expect(
      resolveRuntimeBindingExpressionSync(
        { capability: 'reader.error', path: 'payload.message' },
        { event: errorEvent },
      ),
    ).toBe('This document cannot be opened.');
    expect(
      resolveRuntimeBindingExpressionSync(
        { capability: 'event.reader.locationChange', path: 'payload.locator' },
        { event: locationEvent },
      ),
    ).toBeUndefined();
  });

  it('uses the standard ZORA interaction policy contract', () => {
    const authoringProps: ReaderProps = {
      format: 'epub',
      interactionPolicy: 'passive',
      source: { uri: 'https://example.test/reader.epub' },
    };
    const previewProps: ReaderProps = { ...authoringProps, interactionPolicy: 'enabled' };

    expect(authoringProps.interactionPolicy).toBe('passive');
    expect(previewProps.interactionPolicy).toBe('enabled');
  });
});
