import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const runtimeIndexSource = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');
const registrySource = readFileSync(join(import.meta.dir, 'registry.tsx'), 'utf8');
const runtimeActionSource = readFileSync(join(import.meta.dir, 'useRuntimeAction.ts'), 'utf8');

describe('Studio runtime overlay', () => {
  it('exports the generated-app runtime overlay surface', () => {
    expect(runtimeIndexSource).toContain("export * from './appExtensionRegistry.js';");
    expect(runtimeIndexSource).toContain("export * from './registry.js';");
    expect(runtimeIndexSource).toContain("export * from './runtimeActions.js';");
    expect(runtimeIndexSource).toContain("export * from './useRuntimeAction.js';");
    expect(registrySource).toContain('APP_EXTENSION_COMPONENT_REGISTRY');
    expect(registrySource).toContain('BASE_ZORA_COMPONENT_REGISTRY');
  });

  it('keeps Expo Router and Zora action integration in the Studio runtime surface', () => {
    expect(runtimeActionSource).toContain("from 'expo-router';");
    expect(runtimeActionSource).toContain("from '@ankhorage/zora';");
    expect(runtimeActionSource).toContain("from '@ankhorage/runtime';");
    expect(runtimeActionSource).toContain('const router = useRouter();');
    expect(runtimeActionSource).toContain('const { mode, setMode } = useZoraTheme();');
    expect(runtimeActionSource).toContain('createDbPersistActionHandler({ dbAdapter })');
    expect(runtimeActionSource).toContain('executeRuntimeAction({');
    expect(runtimeActionSource).toContain('actionHandlers: effectiveActionHandlers');
    expect(runtimeActionSource).toContain('mode,');
    expect(runtimeActionSource).toContain('router,');
    expect(runtimeActionSource).toContain('setMode,');
  });
});
