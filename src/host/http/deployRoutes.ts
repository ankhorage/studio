import { randomUUID } from 'node:crypto';

import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type { MonetizationProduct, ReleaseLifecycleControl, ReleasePlan } from '@ankhorage/deploy';
import type {
  ProjectMonetizationInspection,
  ProjectMonetizationPlan,
  ProjectReleaseInput,
  ProjectReleaseInspection,
  ProjectStoreListingAssetLocation,
  StoreListingLocale,
} from '@ankhorage/deploy/project';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectDeployRuntimeInput } from '../../projectDeployRuntimeInput';
import { ProjectDeployService } from '../deploy/ProjectDeployService';
import type { ProjectManager } from '../orchestrator/projectManager';

const MAX_STORE_ASSET_BYTES = 25 * 1024 * 1024;

/*** Register all Studio deployment config, listing, monetization and release HTTP adapters around ProjectDeployService. */
export function registerProjectDeployRoutes(
  fastify: FastifyInstance,
  args: {
    readonly projectManager: ProjectManager;
    readonly workspaceRoot: string;
    readonly service?: ProjectDeployService;
  },
): void {
  ensureBinaryBodyParser(fastify);
  const service =
    args.service ??
    new ProjectDeployService({
      projectManager: args.projectManager,
      workspaceRoot: args.workspaceRoot,
    });

  registerConfigRoutes(fastify, service);
  registerListingRoutes(fastify, service);
  registerMonetizationRoutes(fastify, service);
  registerReleaseRoutes(fastify, service);
}

/*** Register deployment-config read/write routes. */
function registerConfigRoutes(fastify: FastifyInstance, service: ProjectDeployService): void {
  fastify.get('/api/projects/:id/deploy/config', async (req, reply) =>
    respond(reply, () => service.readConfig(projectId(req))),
  );
  fastify.put('/api/projects/:id/deploy/config', async (req, reply) =>
    respond(reply, () =>
      service.updateConfig(projectId(req), req.body as AppDeployManifest | null),
    ),
  );
}

/*** Register store-listing locale and asset routes. */
function registerListingRoutes(fastify: FastifyInstance, service: ProjectDeployService): void {
  fastify.get('/api/projects/:id/deploy/listing', async (req, reply) =>
    respond(reply, () => service.readListing(projectId(req))),
  );
  fastify.put('/api/projects/:id/deploy/listing/locale', async (req, reply) =>
    respond(reply, () =>
      service.writeListingLocale(projectId(req), req.body as StoreListingLocale),
    ),
  );
  fastify.delete('/api/projects/:id/deploy/listing/locale/:locale', async (req, reply) =>
    respond(reply, () => {
      const params = req.params as { readonly locale: string };
      return service.removeListingLocale(projectId(req), params.locale);
    }),
  );
  registerListingAssetWrite(fastify, service);
  fastify.delete('/api/projects/:id/deploy/listing/asset', async (req, reply) =>
    respond(reply, () => service.removeListingAsset(projectId(req), readAssetLocation(req.query))),
  );
}

/*** Register bounded binary store-listing asset writes. */
function registerListingAssetWrite(fastify: FastifyInstance, service: ProjectDeployService): void {
  fastify.put(
    '/api/projects/:id/deploy/listing/asset',
    { bodyLimit: MAX_STORE_ASSET_BYTES },
    /*** Validate binary listing bytes and write them to the requested canonical asset location. */
    async (req, reply) => {
      const { body } = req;
      if (!Buffer.isBuffer(body)) {
        return reply.status(400).send({ error: 'Store listing asset bytes required.' });
      }
      return respond(reply, () =>
        service.writeListingAsset(
          projectId(req),
          readAssetLocation(req.query),
          Uint8Array.from(body),
        ),
      );
    },
  );
}

/*** Register deployment monetization read/write/inspect/execute routes. */
function registerMonetizationRoutes(fastify: FastifyInstance, service: ProjectDeployService): void {
  fastify.get('/api/projects/:id/deploy/monetization', async (req, reply) =>
    respond(reply, () => service.readMonetization(projectId(req))),
  );
  fastify.put('/api/projects/:id/deploy/monetization', async (req, reply) =>
    respond(reply, () => {
      const body = req.body as { readonly products?: readonly MonetizationProduct[] };
      return service.writeMonetization(projectId(req), body.products ?? []);
    }),
  );
  fastify.post('/api/projects/:id/deploy/monetization/inspect', async (req, reply) =>
    respond(reply, () =>
      service.inspectMonetization(projectId(req), req.body as ProjectDeployRuntimeInput),
    ),
  );
  fastify.post('/api/projects/:id/deploy/monetization/execute', async (req, reply) =>
    respond(reply, () => executeMonetizationRequest(service, req)),
  );
}

/*** Project one monetization execute HTTP body into the ProjectDeployService operation input. */
function executeMonetizationRequest(service: ProjectDeployService, req: FastifyRequest) {
  const body = req.body as {
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectMonetizationInspection;
    readonly plan: ProjectMonetizationPlan;
  };
  return service.executeMonetization({
    projectId: projectId(req),
    runtime: body.runtime,
    inspection: body.inspection,
    plan: body.plan,
  });
}

/*** Register release desired-state, inspection, mutation and history routes. */
function registerReleaseRoutes(fastify: FastifyInstance, service: ProjectDeployService): void {
  fastify.get('/api/projects/:id/deploy/release', async (req, reply) =>
    respond(reply, () => service.readRelease(projectId(req))),
  );
  fastify.put('/api/projects/:id/deploy/release', async (req, reply) =>
    respond(reply, () => service.writeRelease(projectId(req), req.body as ProjectReleaseInput)),
  );
  fastify.post('/api/projects/:id/deploy/release/inspect', async (req, reply) =>
    respond(reply, () =>
      service.inspectRelease(projectId(req), req.body as ProjectDeployRuntimeInput),
    ),
  );
  registerReleaseMutationRoutes(fastify, service);
  fastify.get('/api/projects/:id/deploy/release/history', async (req, reply) =>
    respond(reply, () => service.listReleaseHistory(projectId(req))),
  );
}

/*** Register release execute/resume/control mutation routes. */
function registerReleaseMutationRoutes(
  fastify: FastifyInstance,
  service: ProjectDeployService,
): void {
  fastify.post('/api/projects/:id/deploy/release/execute', async (req, reply) =>
    respond(reply, () => executeReleaseRequest(service, req)),
  );
  fastify.post('/api/projects/:id/deploy/release/resume', async (req, reply) =>
    respond(reply, () => resumeReleaseRequest(service, req)),
  );
  fastify.post('/api/projects/:id/deploy/release/control', async (req, reply) =>
    respond(reply, () => executeReleaseControlRequest(service, req)),
  );
}

/*** Start a new release execution with a fresh UUID and return both execution id and service result. */
async function executeReleaseRequest(
  service: ProjectDeployService,
  req: FastifyRequest,
): Promise<unknown> {
  const body = req.body as {
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectReleaseInspection;
    readonly plan: ReleasePlan;
  };
  const executionId = randomUUID();
  const result = await service.executeRelease({
    projectId: projectId(req),
    runtime: body.runtime,
    inspection: body.inspection,
    plan: body.plan,
    executionId,
  });
  return { executionId, result };
}

/*** Resume a prior release under a fresh execution UUID and return both execution id and result. */
async function resumeReleaseRequest(
  service: ProjectDeployService,
  req: FastifyRequest,
): Promise<unknown> {
  const body = req.body as {
    readonly runtime: ProjectDeployRuntimeInput;
    readonly previousExecutionId: string;
  };
  const executionId = randomUUID();
  const result = await service.resumeRelease({
    projectId: projectId(req),
    runtime: body.runtime,
    previousExecutionId: body.previousExecutionId,
    executionId,
  });
  return { executionId, result };
}

/*** Project one release-control HTTP body into the ProjectDeployService control operation. */
function executeReleaseControlRequest(service: ProjectDeployService, req: FastifyRequest) {
  const body = req.body as {
    readonly runtime: ProjectDeployRuntimeInput;
    readonly control: ReleaseLifecycleControl;
  };
  return service.executeReleaseControl({
    projectId: projectId(req),
    runtime: body.runtime,
    control: body.control,
  });
}

/***
 * Ensure a Fastify instance has an octet-stream Buffer body parser.
 * @utility @ankhorage/utility/http/fastify
 */
function ensureBinaryBodyParser(fastify: FastifyInstance): void {
  if (fastify.hasContentTypeParser('application/octet-stream')) return;
  fastify.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    /*** Pass the parsed binary body through unchanged. */
    (_req, body, done) => done(null, body),
  );
}

/*** Parse a deploy store-listing asset location from HTTP query data. */
function readAssetLocation(value: unknown): ProjectStoreListingAssetLocation {
  const query = value as Record<string, unknown>;
  if (query.kind === 'android-shared') {
    if (query.variant !== 'icon' && query.variant !== 'feature') {
      throw new Error('Valid Android shared store asset variant required.');
    }
    return { kind: 'android-shared', variant: query.variant };
  }
  if (
    query.kind !== 'screenshot' ||
    (query.target !== 'android' && query.target !== 'ios') ||
    typeof query.locale !== 'string' ||
    typeof query.variant !== 'string' ||
    typeof query.filename !== 'string'
  ) {
    throw new Error('Valid store screenshot location required.');
  }
  return {
    kind: 'screenshot',
    target: query.target,
    locale: query.locale,
    variant: query.variant,
    filename: query.filename,
  };
}

/***
 * Read the canonical `id` route parameter from a Fastify request.
 * @utility @ankhorage/utility/http/fastify
 */
function projectId(req: FastifyRequest): string {
  return (req.params as { readonly id: string }).id;
}

/***
 * Execute an async Fastify route operation and map thrown failures to a configured HTTP error response.
 * @utility @ankhorage/utility/http/fastify
 */
async function respond(reply: FastifyReply, operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return await operation();
  } catch (error) {
    return reply.status(400).send({ error: readErrorMessage(error) });
  }
}

/***
 * Convert an unknown thrown value to a human-readable message.
 * @utility @ankhorage/utility/error
 */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
