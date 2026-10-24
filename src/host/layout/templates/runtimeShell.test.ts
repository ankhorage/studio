import { expect, test } from 'bun:test';

import { getRuntimeShellImportRequirements, getRuntimeShellTsx } from './runtimeShell';

test('generates Studio Runtime composition with the Studio executor and bundled media', () => {
  const source = getRuntimeShellTsx({
    imports: '',
    includeStudio: true,
    runtimeModuleDeclarations: 'const APP_COMPONENT_REGISTRY = {};',
    useStoredAuthSessionCredentialResolver: true,
    zoraEntrypoint: '@ankhorage/zora',
  });

  expect(source).toContain(`useStudioRuntimeCapabilityExecutor({
    setThemeMode: setMode,
  })`);
  expect(source).toContain('credentialResolver: resolveRuntimeOperationCredential');
  expect(source).toContain('const bundledMediaResolver = createExpoBundledMediaResolver');
  expect(source).toContain('export { bundledMediaRegistry };');
  expect(source).toContain('export const runtimeComponentRegistry = APP_COMPONENT_REGISTRY;');
  expect(source).toContain('registry: runtimeComponentRegistry');
  expect(source).toContain('resolveEventCapability: resolveZoraRuntimeEventCapability');
  expect(source).toContain('onDiagnostics: reportRuntimeDiagnostics');
  expect(source).toContain('ZORA_COMPONENT_META[node.type]?.events?.[eventName]?.eventType');
  expect(source).toContain("Alert.alert('Action unavailable'");
  expect(source).toContain('<RuntimeRendererConfigProvider value={generatedRuntimeConfig}>');
  expect(source).not.toContain('useGeneratedRuntimeCapabilityExecutor');
});

test('generates standalone Runtime composition without Studio dependencies', () => {
  const source = getRuntimeShellTsx({
    imports: '',
    includeStudio: false,
    runtimeModuleDeclarations: 'const APP_COMPONENT_REGISTRY = {};',
    useStoredAuthSessionCredentialResolver: false,
    zoraEntrypoint: '@ankhorage/zora/reader-free',
  });

  expect(
    getRuntimeShellImportRequirements(false, '@ankhorage/zora/reader-free', false),
  ).toContainEqual({
    source: '@/generated/runtimeCapabilityExecutor',
    namedImports: [{ imported: 'createGeneratedRuntimeCapabilityExecutor' }],
  });
  expect(source).toContain('function useGeneratedRuntimeCapabilityExecutor()');
  expect(source).toContain('createGeneratedRuntimeCapabilityExecutor({');
  expect(source).toContain('resolveExpoRuntimeRoutePath(route, params)');
  expect(source).not.toContain('@ankhorage/studio');
  expect(source).toContain('resolveEventCapability: resolveZoraRuntimeEventCapability');
  expect(source).not.toContain('export { bundledMediaRegistry };');
  expect(source).toContain('const runtimeComponentRegistry = APP_COMPONENT_REGISTRY;');
  expect(source).not.toContain('export const runtimeComponentRegistry');
  expect(source).not.toContain('credentialResolver: resolveRuntimeOperationCredential');
});
