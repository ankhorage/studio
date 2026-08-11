import { expoGoogleFontsHostContribution } from '@ankhorage/orchestrator-module-expo-google-fonts/host';
import { expoLocalizationHostContribution } from '@ankhorage/orchestrator-module-expo-localization/host';
import { describe, expect, test } from 'bun:test';
import path from 'path';

import {
  getHostModule,
  type HostModuleContribution,
  listHostModules,
  resolveHostModuleAdminContribution,
} from './catalog';

describe('generic host module registry', () => {
  test('registers unwrapped package-owned lifecycle, layout, and optional admin contributions', () => {
    const registered = listHostModules();

    expect(registered.map((module) => module.id)).toEqual([
      expoLocalizationHostContribution.id,
      expoGoogleFontsHostContribution.id,
    ]);
    expect(getHostModule(expoLocalizationHostContribution.id)?.definition).toBe(
      expoLocalizationHostContribution.definition,
    );
    expect(getHostModule(expoLocalizationHostContribution.id)?.admin).toBe(
      expoLocalizationHostContribution.admin,
    );
    expect(getHostModule(expoGoogleFontsHostContribution.id)?.definition).toBe(
      expoGoogleFontsHostContribution.definition,
    );
    expect(getHostModule(expoGoogleFontsHostContribution.id)?.admin).toBeUndefined();
    expect(getHostModule('unknown/module')).toBeNull();
  });

  test('isolates a malformed optional admin contribution from generic lifecycle state', () => {
    const malformed = {
      ...expoGoogleFontsHostContribution,
      admin: { kind: 'broken' },
    } as unknown as HostModuleContribution;

    expect(resolveHostModuleAdminContribution(malformed)).toEqual({
      admin: null,
      error: `Module '${malformed.id}' has an invalid admin contribution.`,
    });
  });

  test('keeps module domain and Orchestrator ledger implementation out of generic Studio code', async () => {
    const sourceRoot = path.join(import.meta.dir, '..');
    const managerSource = await Bun.file(
      path.join(sourceRoot, 'orchestrator/moduleManager.ts'),
    ).text();
    const resolverSource = await Bun.file(
      path.join(sourceRoot, 'orchestrator/resolveMutations.ts'),
    ).text();
    const genericSource = `${managerSource}\n${resolverSource}`;

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
    expect(managerSource).toContain('.removeModule(operation.moduleId)');
  });
});
