import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const runtimeIndexSource = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');
const registrySource = readFileSync(join(import.meta.dir, 'registry.tsx'), 'utf8');

describe('Studio runtime surface', () => {
  it('keeps the public runtime entrypoint limited to current Studio-owned modules', () => {
    expect(runtimeIndexSource).toContain("export * from './appExtensionRegistry.js';");
    expect(runtimeIndexSource).toContain("export * from './registry.js';");
    expect(runtimeIndexSource).toContain("export * from './runtimeActions.js';");
    expect(runtimeIndexSource).toContain("export * from './useRuntimeAction.js';");
    expect(runtimeIndexSource).not.toContain('previewRegistry');
    expect(runtimeIndexSource).not.toContain('previewRuntimeConfig');
  });

  it('keeps registry ownership as an app-extension re-export instead of rebuilding Runtime registries', () => {
    expect(registrySource).toContain('STUDIO_ZORA_PLUGIN_CATALOG');
    expect(registrySource).not.toContain('createComponentRegistry');
    expect(registrySource).not.toContain('BASE_ZORA_COMPONENT_REGISTRY');
    expect(registrySource).not.toContain('ZORA_COMPONENT_REGISTRY');
    expect(registrySource).not.toContain('DEFAULT_COMPONENT_REGISTRY');
    expect(registrySource).not.toContain('SURFACE_COMPONENT_REGISTRY');
  });
});
