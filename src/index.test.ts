import { describe, expect, test } from 'bun:test';

import { STUDIO_PACKAGE_BOUNDARY, STUDIO_PACKAGE_NAME, STUDIO_PUBLIC_CONTRACTS } from './index';

describe('@ankhorage/studio', () => {
  test('exports the package name', () => {
    expect(STUDIO_PACKAGE_NAME).toBe('@ankhorage/studio');
  });

  test('documents the package boundary', () => {
    const { consumes, doesNotOwn, owns } = STUDIO_PACKAGE_BOUNDARY;

    expect(owns).toContain('Studio authoring contracts');
    expect(owns).toContain('Studio command and event contracts');
    expect(consumes).toContain('@ankhorage/contracts');
    expect(consumes).toContain('@ankhorage/runtime');
    expect(doesNotOwn).toContain('Expo runtime planning');
    expect(doesNotOwn).toContain('React Native UI components');
  });

  test('lists useful public contract exports', () => {
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioManifest');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioContextValue');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('NodePlacement');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('InsertCatalogEntry');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioCommand');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioEvent');
  });
});
