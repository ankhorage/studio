import { expect, test } from 'bun:test';
import path from 'path';

import { listHostModules, resolveHostModuleAdminContribution } from './catalog';

const sourceRoot = path.join(import.meta.dir, '..');

test('generic host module registry > registers package-owned host contributions without Studio lifecycle wrappers', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'catalog.ts')).text();
  const contributions = listHostModules();

  expect(contributions.map((contribution) => contribution.id)).toEqual([
    'expo-localization',
    'expo-google-fonts',
  ]);
  expect(source).toContain('expoLocalizationHostContribution');
  expect(source).toContain('expoGoogleFontsHostContribution');
  expect(source).not.toContain('new ExpoLocalizationModuleProvider');
  expect(source).not.toContain('new ExpoGoogleFontsModuleProvider');
});

test('generic host module registry > isolates malformed optional admin contributions from generic lifecycle state', () => {
  const result = resolveHostModuleAdminContribution({
    id: 'broken-module',
    admin: {
      kind: 'config-schema',
      title: 'Broken module',
      description: 'Malformed field metadata.',
      fields: [{ key: 'broken' }],
    },
  });

  expect(result.admin).toBeNull();
  expect(result.error).toBe("Module 'broken-module' has an invalid admin contribution.");
});

test('generic host module registry > keeps admin runtime opaque until the dedicated runtime boundary validates it', async () => {
  const source = await Bun.file(path.join(import.meta.dir, 'catalog.ts')).text();
  const runtimeSource = await Bun.file(path.join(import.meta.dir, 'adminRuntime.ts')).text();

  expect(source).toContain('readonly adminRuntime?: unknown;');
  expect(runtimeSource).toContain("value.kind === 'module-admin-runtime'");
  expect(runtimeSource).toContain("typeof value.execute === 'function'");
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
