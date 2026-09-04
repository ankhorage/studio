import type { ModuleDefinition } from '@ankhorage/orchestrator';
import { expoGoogleFontsHostContribution } from '@ankhorage/orchestrator-module-expo-google-fonts/host';
import { expoLocalizationHostContribution } from '@ankhorage/orchestrator-module-expo-localization/host';
import { isRecord } from '@ankhorage/utility/object';

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

/*** List the host module contributions available to Studio in deterministic catalog order. */
export function listHostModules(): readonly HostModuleContribution[] {
  return [...HOST_MODULE_CONTRIBUTIONS];
}

/*** Resolve one host module contribution by stable module id. */
export function getHostModule(moduleId: string): HostModuleContribution | null {
  return HOST_MODULE_REGISTRY.get(moduleId) ?? null;
}

/*** Validate and expose a module-owned admin contribution while reporting invalid contribution metadata. */
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

/*** Validate the semantic shape of a module admin config-schema contribution. */
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

/*** Validate one module-admin field definition required by the Studio admin surface. */
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

/*** Build the bounded error response for an invalid module admin contribution. */
function invalidAdmin(moduleId: string): {
  readonly admin: null;
  readonly error: string;
} {
  return { admin: null, error: `Module '${moduleId}' has an invalid admin contribution.` };
}
