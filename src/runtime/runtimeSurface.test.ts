import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const runtimeIndexSource = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');

describe('Studio runtime surface', () => {
  it('keeps the public runtime entrypoint limited to current Studio-owned modules', () => {
    expect(runtimeIndexSource).toContain("export * from './runtimeActions.js';");
    expect(runtimeIndexSource).toContain("export * from './useRuntimeAction.js';");
    expect(runtimeIndexSource).not.toContain('appExtensionRegistry');
    expect(runtimeIndexSource).not.toContain("export * from './registry.js';");
    expect(runtimeIndexSource).not.toContain('STUDIO_ZORA_PLUGIN_CATALOG');
    expect(runtimeIndexSource).not.toContain('previewRegistry');
    expect(runtimeIndexSource).not.toContain('previewRuntimeConfig');
  });
});
