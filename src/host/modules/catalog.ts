import type { ModuleDefinition } from '@ankhorage/orchestrator';
import { expoGoogleFontsHostContribution } from '@ankhorage/orchestrator-module-expo-google-fonts/host';
import { expoLocalizationHostContribution } from '@ankhorage/orchestrator-module-expo-localization/host';

import type { StudioModuleAdminContribution } from '../../moduleAdminContracts';
import type { LayoutMutation } from './layout';

export type HostModuleAdminContribution = StudioModuleAdminContribution;

export interface HostModuleContribution {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly definition: ModuleDefinition;
  readonly normalizeConfig: (input: unknown) => unknown;
  readonly layout?: LayoutMutation;
  readonly admin?: HostModuleAdminContribution;
}

const HOST_MODULE_CONTRIBUTIONS = [
  expoLocalizationHostContribution,
  expoGoogleFontsHostContribution,
] satisfies readonly HostModuleContribution[];

const HOST_MODULE_REGISTRY = new Map<string, HostModuleContribution>(
  HOST_MODULE_CONTRIBUTIONS.map((contribution) => [contribution.id, contribution] as const),
);

export function listHostModules(): readonly HostModuleContribution[] {
  return [...HOST_MODULE_CONTRIBUTIONS];
}

export function getHostModule(moduleId: string): HostModuleContribution | null {
  return HOST_MODULE_REGISTRY.get(moduleId) ?? null;
}

export function resolveHostModuleAdminContribution(contribution: HostModuleContribution | null): {
  readonly admin: HostModuleAdminContribution | null;
  readonly error?: string;
} {
  if (!contribution?.admin) return { admin: null };
  const admin: unknown = contribution.admin;
  if (!isRecord(admin)) return invalidAdmin(contribution.id);
  if (
    admin.kind !== 'config-schema' ||
    typeof admin.title !== 'string' ||
    typeof admin.description !== 'string' ||
    !Array.isArray(admin.fields) ||
    !admin.fields.every(isAdminField)
  ) {
    return invalidAdmin(contribution.id);
  }
  return { admin: contribution.admin };
}

function isAdminField(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    (value.control === 'text' ||
      value.control === 'string-list' ||
      value.control === 'locale-string-map') &&
    typeof value.required === 'boolean'
  );
}

function invalidAdmin(moduleId: string) {
  return { admin: null, error: `Module '${moduleId}' has an invalid admin contribution.` } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
