import { describe, expect, test } from 'bun:test';

import { STUDIO_PACKAGE_BOUNDARY, STUDIO_PACKAGE_NAME, STUDIO_PUBLIC_CONTRACTS } from './index';

describe('@ankhorage/studio', () => {
  test('exports the package name', () => {
    expect(STUDIO_PACKAGE_NAME).toBe('@ankhorage/studio');
  });

  test('documents the package boundary', () => {
    expect(STUDIO_PACKAGE_BOUNDARY.owns).toContain('Studio authoring contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.owns).toContain('Studio command and event contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.consumes).toContain('@ankhorage/contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.consumes).toContain('@ankhorage/runtime');
    expect(STUDIO_PACKAGE_BOUNDARY.doesNotOwn).toContain('Expo runtime planning');
    expect(STUDIO_PACKAGE_BOUNDARY.doesNotOwn).toContain('React Native UI components');
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
