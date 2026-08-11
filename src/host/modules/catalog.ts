import type { ModuleDefinition } from '@ankhorage/orchestrator';
import { expoGoogleFontsHostContribution } from '@ankhorage/orchestrator-module-expo-google-fonts/host';
import { expoLocalizationHostContribution } from '@ankhorage/orchestrator-module-expo-localization/host';

import type {
  StudioModuleAdminContribution,
  StudioModuleAdminField,
} from '../../moduleAdminContracts';
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
  readonly adminRuntime?: unknown;
}

const HOST_MODULE_CONTRIBUTIONS = [
  expoLocalizationHostContribution,
  expoGoogleFontsHostContribution,
] satisfies readonly HostModuleContribution[];

const HOST_MODULE_REGISTRY = new Map<string, HostModuleContribution>(
  HOST_MODULE_CONTRIBUTIONS.map((contribution): [string, HostModuleContribution] => [
    contribution.id,
    contribution,
  ]),
);

export function listHostModules(): readonly HostModuleContribution[] {
  return [...HOST_MODULE_CONTRIBUTIONS];
}

export function getHostModule(moduleId: string): HostModuleContribution | null {
  return HOST_MODULE_REGISTRY.get(moduleId) ?? null;
}

export function resolveHostModuleAdminContribution(
  contribution: { readonly id: string; readonly admin?: unknown } | null,
): {
  readonly admin: HostModuleAdminContribution | null;
  readonly error?: string;
} {
  if (!contribution?.admin) return { admin: null };
  if (!isAdminContribution(contribution.admin)) {
    return invalidAdmin(contribution.id);
  }
  return { admin: contribution.admin };
}

function isAdminContribution(value: unknown): value is HostModuleAdminContribution {
  return (
    isRecord(value) &&
    value.kind === 'config-schema' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    Array.isArray(value.fields) &&
    value.fields.every(isAdminField)
  );
}

function isAdminField(value: unknown): value is StudioModuleAdminField {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    typeof value.control === 'string' &&
    value.control.length > 0 &&
    typeof value.required === 'boolean'
  );
}

function invalidAdmin(moduleId: string): {
  readonly admin: null;
  readonly error: string;
} {
  return { admin: null, error: `Module '${moduleId}' has an invalid admin contribution.` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
