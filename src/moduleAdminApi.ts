import type {
  StudioModuleAdminContribution,
  StudioModuleAdminControl,
  StudioModuleOperationResult,
  StudioModuleState,
} from './moduleAdminContracts';

export class StudioModuleApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudioModuleApiError';
    this.status = status;
  }
}

export async function listProjectModules(projectId: string): Promise<readonly StudioModuleState[]> {
  const value = await requestJson(`/projects/${encodeURIComponent(projectId)}/modules`);
  if (!Array.isArray(value)) throw invalidResponse('Module list response was invalid.');
  return value.map(parseStudioModuleState);
}

export async function getProjectModule(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): Promise<StudioModuleState> {
  const value = await requestJson(createProjectModuleApiPath(input));
  return parseStudioModuleState(value);
}

export async function installProjectModule(input: {
  readonly projectId: string;
  readonly moduleId: string;
  readonly config?: Record<string, unknown>;
}): Promise<StudioModuleOperationResult> {
  return await mutateProjectModule(input, 'install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: input.config }),
  });
}

export async function uninstallProjectModule(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): Promise<StudioModuleOperationResult> {
  return await mutateProjectModule(input, 'uninstall', { method: 'POST' });
}

export async function updateProjectModuleConfig(input: {
  readonly projectId: string;
  readonly moduleId: string;
  readonly config: Record<string, unknown>;
}): Promise<StudioModuleOperationResult> {
  const value = await requestJson(`${createProjectModuleApiPath(input)}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: input.config }),
  });
  return parseOperationResult(value);
}

export async function finalizePendingProjectModules(projectId: string): Promise<number> {
  const value = await requestJson(
    `/projects/${encodeURIComponent(projectId)}/modules/finalize-pending`,
    { method: 'POST' },
  );
  const record = asRecord(value);
  if (record?.success !== true || typeof record.applied !== 'number') {
    throw invalidResponse('Pending module operation response was invalid.');
  }
  return record.applied;
}

export function parseStudioModuleState(value: unknown): StudioModuleState {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.description !== 'string' ||
    typeof record.available !== 'boolean' ||
    typeof record.installed !== 'boolean' ||
    typeof record.pendingRemoval !== 'boolean' ||
    !isStringArray(record.dependencies) ||
    !isStringArray(record.dependents) ||
    (record.registrationVersion !== undefined && typeof record.registrationVersion !== 'string') ||
    (record.installedVersion !== undefined && typeof record.installedVersion !== 'string') ||
    (record.installedAt !== undefined && typeof record.installedAt !== 'string') ||
    (record.adminError !== undefined && typeof record.adminError !== 'string')
  ) {
    throw invalidResponse('Module state response was invalid.');
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    available: record.available,
    installed: record.installed,
    pendingRemoval: record.pendingRemoval,
    ...(typeof record.registrationVersion === 'string'
      ? { registrationVersion: record.registrationVersion }
      : {}),
    ...(typeof record.installedVersion === 'string'
      ? { installedVersion: record.installedVersion }
      : {}),
    ...(typeof record.installedAt === 'string' ? { installedAt: record.installedAt } : {}),
    dependencies: [...record.dependencies],
    dependents: [...record.dependents],
    config: record.config,
    admin: record.admin === null ? null : parseAdminContribution(record.admin),
    ...(typeof record.adminError === 'string' ? { adminError: record.adminError } : {}),
  };
}

function parseAdminContribution(value: unknown): StudioModuleAdminContribution {
  const record = asRecord(value);
  if (
    record?.kind !== 'config-schema' ||
    typeof record.title !== 'string' ||
    typeof record.description !== 'string' ||
    !Array.isArray(record.fields)
  ) {
    throw invalidResponse('Module admin contribution was invalid.');
  }
  return {
    kind: 'config-schema',
    title: record.title,
    description: record.description,
    fields: record.fields.map((field) => {
      const candidate = asRecord(field);
      if (
        candidate === null ||
        typeof candidate.key !== 'string' ||
        typeof candidate.label !== 'string' ||
        !isAdminControl(candidate.control) ||
        typeof candidate.required !== 'boolean'
      ) {
        throw invalidResponse('Module admin field was invalid.');
      }
      return {
        key: candidate.key,
        label: candidate.label,
        control: candidate.control,
        required: candidate.required,
      };
    }),
  };
}

async function mutateProjectModule(
  input: { readonly projectId: string; readonly moduleId: string },
  operation: 'install' | 'uninstall',
  init: RequestInit,
): Promise<StudioModuleOperationResult> {
  const value = await requestJson(`${createProjectModuleApiPath(input)}/${operation}`, init);
  return parseOperationResult(value);
}

function parseOperationResult(value: unknown): StudioModuleOperationResult {
  const record = asRecord(value);
  if (
    record?.success !== true ||
    typeof record.needsReload !== 'boolean' ||
    (record.pending !== undefined && typeof record.pending !== 'boolean') ||
    (record.installed !== undefined && !isStringArray(record.installed)) ||
    (record.reconfigured !== undefined && typeof record.reconfigured !== 'string')
  ) {
    throw invalidResponse('Module operation response was invalid.');
  }
  return {
    success: true,
    module: record.module === null ? null : parseStudioModuleState(record.module),
    needsReload: record.needsReload,
    ...(typeof record.pending === 'boolean' ? { pending: record.pending } : {}),
    ...(isStringArray(record.installed) ? { installed: [...record.installed] } : {}),
    ...(typeof record.reconfigured === 'string' ? { reconfigured: record.reconfigured } : {}),
  };
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const { API_BASE } = await import('./core/constants');
  const response = await fetch(`${API_BASE}${path}`, init);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new StudioModuleApiError('The Studio host returned a non-JSON module response.', 502);
  }
  if (!response.ok) {
    const record = asRecord(value);
    throw new StudioModuleApiError(
      typeof record?.error === 'string' ? record.error : 'The module request failed.',
      response.status,
    );
  }
  return value;
}

export function createProjectModuleApiPath(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): string {
  return `/projects/${encodeURIComponent(input.projectId)}/modules/${encodeURIComponent(input.moduleId)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isAdminControl(value: unknown): value is StudioModuleAdminControl {
  return typeof value === 'string' && value.length > 0;
}

function invalidResponse(message: string): StudioModuleApiError {
  return new StudioModuleApiError(message, 502);
}
