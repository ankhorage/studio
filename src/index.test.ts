import { describe, expect, test } from 'bun:test';

import { STUDIO_PACKAGE_BOUNDARY, STUDIO_PACKAGE_NAME } from './index';

describe('@ankhorage/studio', () => {
  test('exports the package name', () => {
    expect(STUDIO_PACKAGE_NAME).toBe('@ankhorage/studio');
  });

  test('documents the package boundary', () => {
    expect(STUDIO_PACKAGE_BOUNDARY.owns).toContain('Studio authoring contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.consumes).toContain('@ankhorage/runtime');
    expect(STUDIO_PACKAGE_BOUNDARY.doesNotOwn).toContain('Expo runtime planning');
  });
});
