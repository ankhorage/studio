import { expect, test } from 'bun:test';
import path from 'path';

const registrySource = await Bun.file(
  path.join(import.meta.dir, 'moduleAdminViewRegistry.ts'),
).text();
const hostSource = await Bun.file(path.join(import.meta.dir, 'ModuleAdminViewHost.tsx')).text();
const pageSource = await Bun.file(
  path.join(import.meta.dir, 'pages/ModuleDetailAdminPage.tsx'),
).text();

test('registers package-owned views without importing module operation semantics', () => {
  expect(registrySource).toContain('@ankhorage/orchestrator-module-expo-localization/admin-view');
  expect(registrySource).not.toContain('EXPO_LOCALIZATION_ADMIN_OPERATIONS');
  expect(registrySource).not.toContain('config.add-locale');
  expect(registrySource).not.toContain('dictionary.');
  expect(registrySource).not.toContain('link-translation-key');
});

test('keeps the generic view host opaque and metadata-injected', () => {
  expect(hostSource).toContain('executeProjectModuleAdminOperation');
  expect(hostSource).toContain('ZORA_COMPONENT_META');
  expect(hostSource).not.toContain('expo-localization');
  expect(hostSource).not.toContain('dictionary.');
  expect(hostSource).not.toContain('link-translation-key');
});

test('hosts rich module administration only through the canonical detail page', () => {
  expect(pageSource).toContain('getStudioModuleAdminView(module.id)');
  expect(pageSource).toContain('<ModuleAdminViewHost');
  expect(pageSource).not.toContain('expo-localization');
  expect(pageSource).not.toContain('/ankh/localization');
});
