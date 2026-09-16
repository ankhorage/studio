import { expect, test } from 'bun:test';
import path from 'path';

const sourceRoot = path.join(import.meta.dir, '..');

test('generic host module registry > registers unwrapped package-owned lifecycle, layout, and optional admin contributions', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'catalog.ts')).text();

  expect(source).toContain('lifecycle: expoLocalizationModuleProvider');
  expect(source).toContain('lifecycle: expoGoogleFontsModuleProvider');
  expect(source).toContain('layout: expoLocalizationLayoutContribution');
  expect(source).toContain('layout: expoGoogleFontsLayoutContribution');
  expect(source).not.toContain('new ExpoLocalizationModuleProvider');
  expect(source).not.toContain('new ExpoGoogleFontsModuleProvider');
});

test('generic host module registry > isolates malformed optional admin contributions from generic lifecycle state', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'catalog.ts')).text();

  expect(source).toContain('resolveHostModuleAdminContribution');
  expect(source).toContain('adminError');
});

test('generic host module registry > accepts only the generic single-entry admin runtime shape', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'catalog.ts')).text();

  expect(source).toContain("entry.kind !== 'runtime'");
  expect(source).toContain('entry.module !== contribution.id');
});

test('generic host module registry > keeps module domain and Orchestrator ledger implementation out of generic Studio code', async () => {
  const managerSource = await Bun.file(
    path.join(sourceRoot, 'orchestrator/moduleManager.ts'),
  ).text();
  const resolverSource = await Bun.file(
    path.join(sourceRoot, 'orchestrator/resolveMutations.ts'),
  ).text();
  const runtimeSource = await Bun.file(path.join(import.meta.dir, 'adminRuntime.ts')).text();
  const genericSource = `${managerSource}\n${resolverSource}\n${runtimeSource}`;

  expect(genericSource).not.toContain('expo-localization');
  expect(genericSource).not.toContain('expo-google-fonts');
  expect(genericSource).not.toContain('LocalizationModuleProvider');
  expect(genericSource).not.toContain('GoogleFontsProvider');
  expect(genericSource).not.toContain('src/modules/');
  expect(genericSource).not.toContain('LEDGER_DIR');
  expect(genericSource).not.toContain('ledgerPath');
  expect(genericSource).not.toContain('.ankh/ledger');
  expect(genericSource).not.toContain('MANAGED_MODULE_DIRS');
  expect(managerSource).toContain('.listModules()');
  expect(managerSource).toContain('.getModule(moduleId)');
  expect(managerSource).toContain('.installModule(moduleId');
  expect(managerSource).toContain('.reconfigureModule(moduleId');
  expect(managerSource).not.toContain('.removeModule(');
});
