import type {
  ApmApplyInput,
  ApmApplyPermissions,
  ApmPlanPackageSelection,
  ApmPlanPolicyInput,
  ApmPlanProjectInput,
  ApmPlanResult,
  ApmPlanTargetSelection,
  ApmStatusAvailabilityMode,
  ApmStatusInput,
  ApmVerifyInput,
} from '@ankhorage/apm/types';
import { hasOnlyKeys, isRecord } from '@ankhorage/utility/object';
import type { FastifyInstance, FastifyReply } from 'fastify';

interface ProjectUpdateRouteService {
  readonly statusAsync: (input: ApmStatusInput) => Promise<unknown>;
  readonly planAsync: (input: ApmPlanProjectInput) => Promise<unknown>;
  readonly applyAsync: (input: ApmApplyInput) => Promise<unknown>;
  readonly verifyAsync: (input: ApmVerifyInput) => Promise<unknown>;
}

interface ProjectUpdateRouteOptions {
  readonly service: ProjectUpdateRouteService;
  readonly resolveProjectRootAsync: (projectId: string) => Promise<string | undefined>;
}

/*** Register the authorized HTTP adapter for Studio's composed APM project-update lifecycle. */
export function registerProjectUpdateRoutes(
  fastify: FastifyInstance,
  options: ProjectUpdateRouteOptions,
): void {
  fastify.get('/api/projects/:id/updates/status', async (request, reply) => {
    const context = await resolveRequestContext(request.params, options, reply);
    if (context === undefined) return;
    const query = isRecord(request.query) ? request.query : {};
    if (!hasOnlyKeys(query, ['availability']) || !isAvailability(query.availability)) {
      return sendInvalidRequest(reply);
    }
    const input: ApmStatusInput = {
      rootPath: context.rootPath,
      ...(query.availability === undefined ? {} : { availability: query.availability }),
    };
    return invokeReadOnly(reply, () => options.service.statusAsync(input));
  });

  fastify.post('/api/projects/:id/updates/plan', async (request, reply) => {
    const context = await resolveRequestContext(request.params, options, reply);
    if (context === undefined) return;
    const body = request.body === undefined ? {} : request.body;
    if (!isPlanRequest(body)) return sendInvalidRequest(reply);
    const input: ApmPlanProjectInput = {
      rootPath: context.rootPath,
      ...(body.availability === undefined ? {} : { availability: body.availability }),
      ...(body.policy === undefined ? {} : { policy: body.policy }),
    };
    return invokeLifecycle(reply, () => options.service.planAsync(input));
  });

  fastify.post('/api/projects/:id/updates/apply', async (request, reply) => {
    const context = await resolveRequestContext(request.params, options, reply);
    if (context === undefined) return;
    const { body } = request;
    if (!isApplyRequest(body)) return sendInvalidRequest(reply);
    if (body.plan.rootPath !== context.rootPath) {
      return reply.status(409).send({ error: 'The reviewed plan belongs to another project.' });
    }
    return invokeLifecycle(reply, () =>
      options.service.applyAsync({
        mode: 'start',
        plan: body.plan,
        permissions: body.permissions,
      }),
    );
  });

  fastify.post('/api/projects/:id/updates/resume', async (request, reply) => {
    const context = await resolveRequestContext(request.params, options, reply);
    if (context === undefined) return;
    const { body } = request;
    if (!isResumeRequest(body)) return sendInvalidRequest(reply);
    return invokeLifecycle(reply, () =>
      options.service.applyAsync({
        mode: 'resume',
        rootPath: context.rootPath,
        operationId: body.operationId,
        permissions: body.permissions,
      }),
    );
  });

  fastify.post('/api/projects/:id/updates/verify', async (request, reply) => {
    const context = await resolveRequestContext(request.params, options, reply);
    if (context === undefined) return;
    const { body } = request;
    if (!isOperationRequest(body)) return sendInvalidRequest(reply);
    return invokeLifecycle(reply, () =>
      options.service.verifyAsync({
        rootPath: context.rootPath,
        operationId: body.operationId,
      }),
    );
  });
}

/*** Resolve a request's validated project id to its server-owned project root. */
async function resolveRequestContext(
  params: unknown,
  options: ProjectUpdateRouteOptions,
  reply: FastifyReply,
): Promise<{ readonly rootPath: string } | undefined> {
  if (!isRecord(params) || typeof params.id !== 'string' || params.id.length === 0) {
    sendInvalidRequest(reply);
    return undefined;
  }
  try {
    const rootPath = await options.resolveProjectRootAsync(params.id);
    if (rootPath === undefined) {
      reply.status(404).send({ error: 'Project not found.' });
      return undefined;
    }
    return { rootPath };
  } catch {
    reply.status(404).send({ error: 'Project not found.' });
    return undefined;
  }
}

/*** Execute one read-only APM request without leaking host exception details. */
async function invokeReadOnly(
  reply: FastifyReply,
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await operation();
  } catch {
    return reply.status(500).send({ error: 'Project update request failed.' });
  }
}

/*** Execute one APM lifecycle request and map incomplete or blocked structured results to conflict. */
async function invokeLifecycle(
  reply: FastifyReply,
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    const result = await operation();
    if (isLifecycleConflict(result)) return reply.status(409).send(result);
    return result;
  } catch {
    return reply.status(500).send({ error: 'Project update request failed.' });
  }
}

/*** Detect structured APM plan/apply/verify results that require further user action. */
function isLifecycleConflict(value: unknown): boolean {
  if (!isRecord(value) || typeof value.operation !== 'string') return false;
  if (value.operation === 'plan') return value.complete === false;
  if (value.operation === 'apply') return value.status !== 'completed';
  if (value.operation === 'verify') return value.verified === false;
  return false;
}

/*** Return a stable bad-request response without echoing untrusted request data. */
function sendInvalidRequest(reply: FastifyReply): unknown {
  return reply.status(400).send({ error: 'Invalid project update request.' });
}

/*** Validate the optional APM availability mode. */
function isAvailability(value: unknown): value is ApmStatusAvailabilityMode | undefined {
  return value === undefined || value === 'refresh' || value === 'offline';
}

/*** Validate the bounded request body accepted by the plan route. */
function isPlanRequest(value: unknown): value is {
  readonly availability?: ApmStatusAvailabilityMode;
  readonly policy?: ApmPlanPolicyInput;
} {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['availability', 'policy']) &&
    isAvailability(value.availability) &&
    (value.policy === undefined || isPlanPolicy(value.policy))
  );
}

/*** Validate the APM plan policy fields exposed by the host adapter. */
function isPlanPolicy(value: unknown): value is ApmPlanPolicyInput {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'dependencyUpdates',
      'selections',
      'repairInstallations',
      'repairProjections',
      'maxGeneratorIterations',
    ]) &&
    (value.dependencyUpdates === undefined ||
      value.dependencyUpdates === 'safe' ||
      value.dependencyUpdates === 'selected' ||
      value.dependencyUpdates === 'none') &&
    (value.selections === undefined ||
      (Array.isArray(value.selections) && value.selections.every(isPlanPackageSelection))) &&
    (value.repairInstallations === undefined || typeof value.repairInstallations === 'boolean') &&
    (value.repairProjections === undefined || typeof value.repairProjections === 'boolean') &&
    (value.maxGeneratorIterations === undefined ||
      (typeof value.maxGeneratorIterations === 'number' &&
        Number.isInteger(value.maxGeneratorIterations) &&
        value.maxGeneratorIterations > 0))
  );
}

/*** Validate one package selection in a host-authored APM plan request. */
function isPlanPackageSelection(value: unknown): value is ApmPlanPackageSelection {
  if (!isRecord(value) || !hasOnlyKeys(value, ['selector', 'target'])) return false;
  const { selector } = value;
  if (
    !isRecord(selector) ||
    !hasOnlyKeys(selector, ['name', 'packageId', 'installRootId', 'ownerPath'])
  ) {
    return false;
  }
  return (
    typeof selector.name === 'string' &&
    selector.name.length > 0 &&
    isOptionalString(selector.packageId) &&
    isOptionalString(selector.installRootId) &&
    isOptionalString(selector.ownerPath) &&
    isPlanTargetSelection(value.target)
  );
}

/*** Validate one compatible/latest/exact APM target selection. */
function isPlanTargetSelection(value: unknown): value is ApmPlanTargetSelection {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'compatible') return hasOnlyKeys(value, ['kind']);
  if (value.kind === 'latest') {
    return (
      hasOnlyKeys(value, ['kind', 'allowPrerelease', 'manifestRange']) &&
      isOptionalBoolean(value.allowPrerelease) &&
      isOptionalString(value.manifestRange)
    );
  }
  if (value.kind === 'version') {
    return (
      hasOnlyKeys(value, [
        'kind',
        'version',
        'allowPrerelease',
        'allowDowngrade',
        'manifestRange',
      ]) &&
      typeof value.version === 'string' &&
      value.version.length > 0 &&
      isOptionalBoolean(value.allowPrerelease) &&
      isOptionalBoolean(value.allowDowngrade) &&
      isOptionalString(value.manifestRange)
    );
  }
  return false;
}

/*** Validate the reviewed start request without accepting a caller-controlled project root. */
function isApplyRequest(
  value: unknown,
): value is { readonly plan: ApmPlanResult; readonly permissions: ApmApplyPermissions } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['plan', 'permissions']) &&
    isPlanResult(value.plan) &&
    isApplyPermissions(value.permissions)
  );
}

/*** Validate the durable resume request without accepting a caller-controlled project root. */
function isResumeRequest(
  value: unknown,
): value is { readonly operationId: string; readonly permissions: ApmApplyPermissions } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['operationId', 'permissions']) &&
    isNonEmptyString(value.operationId) &&
    isApplyPermissions(value.permissions)
  );
}

/*** Validate the verify request's operation identity. */
function isOperationRequest(value: unknown): value is { readonly operationId: string } {
  return (
    isRecord(value) && hasOnlyKeys(value, ['operationId']) &&
    isNonEmptyString(value.operationId)
  );
}

/*** Validate explicit APM execution permissions. */
function isApplyPermissions(value: unknown): value is ApmApplyPermissions {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['ownerCode', 'lifecycleScripts', 'externalEffects']) &&
    typeof value.ownerCode === 'boolean' &&
    typeof value.lifecycleScripts === 'boolean' &&
    typeof value.externalEffects === 'boolean'
  );
}

/*** Validate a reviewed APM plan envelope before passing it back to the executor for revalidation. */
function isPlanResult(value: unknown): value is ApmPlanResult {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    value.operation === 'plan' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.rootPath) &&
    typeof value.complete === 'boolean' &&
    isRecord(value.policy) &&
    isRecord(value.executor) &&
    isRecord(value.inputFingerprint) &&
    Array.isArray(value.targets) &&
    Array.isArray(value.files) &&
    Array.isArray(value.packages) &&
    Array.isArray(value.artifacts) &&
    Array.isArray(value.steps) &&
    Array.isArray(value.effects) &&
    Array.isArray(value.findings) &&
    Array.isArray(value.blockers) &&
    Array.isArray(value.diagnostics)
  );
}

/*** Validate an optional string field. */
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/*** Validate an optional boolean field. */
function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

/*** Validate a required non-empty string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
