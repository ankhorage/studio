import type {
  StudioModuleAdminContribution,
  StudioModuleAdminControl,
  StudioModuleOperationResult,
  StudioModuleState,
} from './moduleAdminContracts';

export class StudioModuleApiError extends Error {
  readonly status: number;

  /*** Create a module API error carrying the HTTP-compatible status returned to Studio. */
  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudioModuleApiError';
    this.status = status;
  }
}

/***
 * Fetch and validate the modules available to one Studio project.
 * @todo Move module HTTP access from the source root into the modules package-edge adapter.
 */
export async function listProjectModules(projectId: string): Promise<readonly StudioModuleState[]> {
  const value = await requestJson(`/projects/${encodeURIComponent(projectId)}/modules`);
  if (!Array.isArray(value)) throw invalidResponse('Module list response was invalid.');
  return value.map(parseStudioModuleState);
}

/***
 * Fetch and validate one project module by project and module identifier.
 * @todo Move module HTTP access from the source root into the modules package-edge adapter.
 */
export async function getProjectModule(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): Promise<StudioModuleState> {
  const value = await requestJson(createProjectModuleApiPath(input));
  return parseStudioModuleState(value);
}

/***
 * Install one module for a project with an optional authored configuration.
 * @todo Move module installation orchestration into the modules application responsibility.
 */
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

/***
 * Uninstall one module from a project.
 * @todo Move module removal orchestration into the modules application responsibility.
 */
export async function uninstallProjectModule(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): Promise<StudioModuleOperationResult> {
  return await mutateProjectModule(input, 'uninstall', { method: 'POST' });
}

/***
 * Replace the authored configuration for one installed project module.
 * @todo Move module configuration mutation into the modules application responsibility.
 */
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

/***
 * Execute one module-owned admin operation and return its successful result payload.
 * @todo Keep module admin-operation semantics in the modules domain while moving concrete HTTP transport to its edge adapter.
 */
export async function executeProjectModuleAdminOperation(input: {
  readonly projectId: string;
  readonly moduleId: string;
  readonly operation: string;
  readonly input?: unknown;
  readonly componentMeta?: unknown;
}): Promise<unknown> {
  const value = await requestJson(createProjectModuleAdminOperationApiPath(input), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(input.input === undefined ? {} : { input: input.input }),
      ...(input.componentMeta === undefined ? {} : { componentMeta: input.componentMeta }),
    }),
  });
  const record = asRecord(value);
  if (record?.success !== true) {
    throw invalidResponse('Module admin operation response was invalid.');
  }
  return record.result;
}

/***
 * Ask the Studio host to finalize pending module changes and return the applied count.
 * @todo Move pending-module finalization into the modules application responsibility.
 */
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

/***
 * Validate an unknown module-state response and project it into the canonical Studio module model.
 * @todo Keep module response semantics in the modules domain rather than the source root.
 */
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

/*** Validate and normalize a module-provided admin configuration-schema contribution. */
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

/*** Execute an install/uninstall module mutation through the shared module request and result parser. */
async function mutateProjectModule(
  input: { readonly projectId: string; readonly moduleId: string },
  operation: 'install' | 'uninstall',
  init: RequestInit,
): Promise<StudioModuleOperationResult> {
  const value = await requestJson(`${createProjectModuleApiPath(input)}/${operation}`, init);
  return parseOperationResult(value);
}

/*** Validate and normalize the host result of a module mutation. */
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

/***
 * Fetch a path, decode a JSON response, and surface non-success status as a typed HTTP error.
 * @utility @ankhorage/utility/http
 */
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

/***
 * Build the encoded REST path for a project-owned resource identified by two path segments.
 * @utility @ankhorage/utility/url
 */
export function createProjectModuleApiPath(input: {
  readonly projectId: string;
  readonly moduleId: string;
}): string {
  return `/projects/${encodeURIComponent(input.projectId)}/modules/${encodeURIComponent(input.moduleId)}`;
}

/***
 * Extend an encoded resource path with one required non-empty operation segment.
 * @utility @ankhorage/utility/url
 */
export function createProjectModuleAdminOperationApiPath(input: {
  readonly projectId: string;
  readonly moduleId: string;
  readonly operation: string;
}): string {
  const operation = input.operation.trim();
  if (!operation) throw new Error('Module admin operation must not be empty.');
  return `${createProjectModuleApiPath(input)}/admin/${encodeURIComponent(operation)}`;
}

/***
 * Narrow an unknown value to a strict non-array record or return null.
 * @utility @ankhorage/utility/value
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/***
 * Return whether an unknown value is a non-null, non-array object record.
 * @utility @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/***
 * Return whether an unknown value is an array containing only strings.
 * @utility @ankhorage/utility/array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/***
 * Return whether an unknown value is a non-empty string.
 * @utility @ankhorage/utility/string
 */
function isAdminControl(value: unknown): value is StudioModuleAdminControl {
  return typeof value === 'string' && value.length > 0;
}

/***
 * Create a typed bad-gateway-style API error for an invalid upstream response.
 * @utility @ankhorage/utility/http
 */
function invalidResponse(message: string): StudioModuleApiError {
  return new StudioModuleApiError(message, 502);
}
