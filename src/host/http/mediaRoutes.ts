import {
  MEDIA_ASSET_KINDS,
  type MediaAssetKind,
  type MediaBundledSource,
  type MediaStorageSource,
} from '@ankhorage/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ProjectBundledMediaService } from '../media/projectBundledMediaService';
import { ProjectMediaService } from '../media/projectMediaService';
import type { ProjectManager } from '../orchestrator/projectManager';

const MAX_MEDIA_BODY_BYTES = 100 * 1024 * 1024;

/*** Register Studio media ingest/bundle/resolve/cleanup HTTP adapters and binary-body support. */
export function registerProjectMediaRoutes(
  fastify: FastifyInstance,
  args: { readonly projectManager: ProjectManager; readonly workspaceRoot: string },
) {
  ensureBinaryBodyParser(fastify);
  const storageService = new ProjectMediaService(args.projectManager, args.workspaceRoot);
  const bundledService = new ProjectBundledMediaService(args.workspaceRoot);

  /*** Ingest uploaded media bytes into managed storage. */
  registerMediaByteRoute(fastify, '/api/projects/:id/media/ingest', (id, input) =>
    storageService.ingest(id, input),
  );
  /*** Bundle uploaded media bytes into generated project assets. */
  registerMediaByteRoute(fastify, '/api/projects/:id/media/bundle', (id, input) =>
    bundledService.bundle(id, input),
  );
  registerMediaCleanupRoute(fastify, storageService, bundledService);
  /*** Resolve a canonical storage source to its runtime URL. */
  fastify.post('/api/projects/:id/media/resolve', async (req, reply) => {
    const source = readStorageSource((req.body as { source?: unknown } | undefined)?.source);
    if (!source) return reply.status(400).send({ error: 'Canonical storage source required.' });
    try {
      const { id } = req.params as { id: string };
      return { url: await storageService.resolve(id, source) };
    } catch (error) {
      return reply.status(400).send({ error: readErrorMessage(error) });
    }
  });
}

/*** Register cleanup for canonical managed storage/bundled media sources. */
function registerMediaCleanupRoute(
  fastify: FastifyInstance,
  storageService: ProjectMediaService,
  bundledService: ProjectBundledMediaService,
): void {
  /*** Remove one canonical managed media source through its owning storage/bundle service. */
  fastify.post('/api/projects/:id/media/cleanup', async (req, reply) => {
    const source = readCleanupSource((req.body as { source?: unknown } | undefined)?.source);
    if (!source)
      return reply.status(400).send({ error: 'Canonical managed media source required.' });
    try {
      const { id } = req.params as { id: string };
      if (source.kind === 'storage') await storageService.remove(id, source);
      else await bundledService.remove(id, source);
      return { cleanup: 'removed' };
    } catch (error) {
      return reply.status(400).send({ error: readErrorMessage(error) });
    }
  });
}

/***
 * Ensure a Fastify instance has an octet-stream parser that exposes uploaded bytes as Buffer.
 * @utility @ankhorage/utility/http/fastify
 */
function ensureBinaryBodyParser(fastify: FastifyInstance) {
  if (fastify.hasContentTypeParser('application/octet-stream')) return;
  fastify.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    /*** Pass Fastify's parsed binary body through unchanged. */
    (_req, body, done) => {
      done(null, body);
    },
  );
}

/*** Register one bounded binary-media write route around a project-scoped ingest function. */
function registerMediaByteRoute(
  fastify: FastifyInstance,
  route: string,
  ingest: (
    id: string,
    input: NonNullable<ReturnType<typeof readIngestRequest>>,
  ) => Promise<unknown>,
) {
  /*** Parse media metadata/bytes, execute the injected ingest operation, and map failures to HTTP 400. */
  fastify.post(
    route,
    { bodyLimit: MAX_MEDIA_BODY_BYTES },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const input = readIngestRequest(req);
      if (!input)
        return reply.status(400).send({ error: 'Valid media metadata and bytes are required.' });
      try {
        const { id } = req.params as { id: string };
        return { asset: await ingest(id, input) };
      } catch (error) {
        return reply.status(400).send({ error: readErrorMessage(error) });
      }
    },
  );
}

/*** Parse media-ingest query metadata plus a binary request body into the media service input. */
function readIngestRequest(req: FastifyRequest) {
  const query = req.query as Record<string, unknown>;
  const kind = typeof query.kind === 'string' ? query.kind : '';
  if (!MEDIA_ASSET_KINDS.includes(kind as MediaAssetKind) || !Buffer.isBuffer(req.body))
    return null;
  if (typeof query.assetId !== 'string' || typeof query.name !== 'string') return null;
  return {
    assetId: query.assetId,
    name: query.name,
    kind: kind as MediaAssetKind,
    body: new Uint8Array(req.body),
    contentType: readString(query.contentType),
    sizeBytes: readNumber(query.sizeBytes),
    width: readNumber(query.width),
    height: readNumber(query.height),
    durationMs: readNumber(query.durationMs),
  };
}

/***
 * Parse a managed media cleanup source across canonical storage and bundled source shapes.
 * @todo Move this reusable media-source guard beside the media contracts owner rather than generic Utility.
 */
function readCleanupSource(value: unknown): MediaBundledSource | MediaStorageSource | null {
  const storage = readStorageSource(value);
  if (storage) return storage;
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (source.kind !== 'bundled' || typeof source.path !== 'string' || source.path.length === 0)
    return null;
  return { kind: 'bundled', path: source.path };
}

/***
 * Parse a canonical MediaStorageSource from unknown input.
 * @todo Move this guard beside `MediaStorageSource` in the media contracts owner.
 */
function readStorageSource(value: unknown): MediaStorageSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (
    source.kind !== 'storage' ||
    typeof source.bucket !== 'string' ||
    typeof source.path !== 'string'
  )
    return null;
  return {
    kind: 'storage',
    bucket: source.bucket,
    path: source.path,
    ...(typeof source.storageId === 'string' ? { storageId: source.storageId } : {}),
  };
}

/***
 * Read a non-empty string from an unknown value.
 * @utility @ankhorage/utility/string
 */
function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/***
 * Parse a non-empty string as a finite non-negative number.
 * @utility @ankhorage/utility/number
 */
function readNumber(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/***
 * Convert an unknown thrown value to a human-readable message.
 * @utility @ankhorage/utility/error
 */
function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
