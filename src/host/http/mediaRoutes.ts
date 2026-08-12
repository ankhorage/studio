import { MEDIA_ASSET_KINDS, type MediaAssetKind, type MediaStorageSource } from '@ankhorage/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectMediaService } from '../media/projectMediaService';

const MAX_MEDIA_BODY_BYTES = 100 * 1024 * 1024;

export function registerProjectMediaRoutes(
  fastify: FastifyInstance,
  args: { readonly projectManager: ProjectManager; readonly workspaceRoot: string },
) {
  if (!fastify.hasContentTypeParser('application/octet-stream')) {
    fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });
  }
  const service = new ProjectMediaService(args.projectManager, args.workspaceRoot);
  fastify.post(
    '/api/projects/:id/media/ingest',
    { bodyLimit: MAX_MEDIA_BODY_BYTES },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const input = readIngestRequest(req);
      if (!input) return reply.status(400).send({ error: 'Valid media metadata and bytes are required.' });
      try {
        const { id } = req.params as { id: string };
        return { asset: await service.ingest(id, input) };
      } catch (error) {
        return reply.status(400).send({ error: readErrorMessage(error) });
      }
    },
  );
  fastify.post('/api/projects/:id/media/resolve', async (req, reply) => {
    const source = readStorageSource((req.body as { source?: unknown } | undefined)?.source);
    if (!source) return reply.status(400).send({ error: 'Canonical storage source required.' });
    try {
      const { id } = req.params as { id: string };
      return { url: await service.resolve(id, source) };
    } catch (error) {
      return reply.status(400).send({ error: readErrorMessage(error) });
    }
  });
}

function readIngestRequest(req: FastifyRequest) {
  const query = req.query as Record<string, unknown>;
  const kind = typeof query.kind === 'string' ? query.kind : '';
  if (!MEDIA_ASSET_KINDS.includes(kind as MediaAssetKind) || !Buffer.isBuffer(req.body)) return null;
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

function readStorageSource(value: unknown): MediaStorageSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (source.kind !== 'storage' || typeof source.bucket !== 'string' || typeof source.path !== 'string') return null;
  return {
    kind: 'storage',
    bucket: source.bucket,
    path: source.path,
    ...(typeof source.storageId === 'string' ? { storageId: source.storageId } : {}),
  };
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
