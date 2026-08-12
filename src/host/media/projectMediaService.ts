import type { MediaAsset, MediaAssetKind, MediaStorageSource } from '@ankhorage/contracts';

import type { ProjectManager } from '../orchestrator/projectManager';
import {
  resolveProjectMediaStorage,
  type ProjectMediaStorageContext,
} from './projectMediaStorage';

export interface ProjectMediaIngestInput {
  readonly assetId: string;
  readonly name: string;
  readonly kind: MediaAssetKind;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
}

type MediaStorageResolver = (args: {
  readonly projectId: string;
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
}) => Promise<ProjectMediaStorageContext>;

export class ProjectMediaService {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly workspaceRoot: string,
    private readonly resolveStorage: MediaStorageResolver = resolveProjectMediaStorage,
  ) {}

  async ingest(projectId: string, input: ProjectMediaIngestInput): Promise<MediaAsset> {
    const storage = await this.getStorage(projectId);
    const path = createAuthoringMediaPath(input.assetId, input.name);
    const uploaded = await storage.adapter.upload({
      bucket: storage.bucket,
      path,
      body: input.body,
      contentType: input.contentType,
      upsert: false,
    });
    if (!uploaded.ok) throw new Error(uploaded.error.message);
    return {
      id: input.assetId,
      name: input.name,
      kind: input.kind,
      source: { kind: 'storage', ...uploaded.data.asset },
      contentType: input.contentType,
      metadata: {
        originalFileName: input.name,
        sizeBytes: input.sizeBytes ?? input.body.byteLength,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async resolve(projectId: string, source: MediaStorageSource): Promise<string> {
    const storage = await this.getStorage(projectId);
    if (source.bucket !== storage.bucket || !source.path.startsWith('authoring/')) {
      throw new Error('Media storage reference is outside the project authoring pool.');
    }
    const resolved = await storage.adapter.resolve({ ...source, access: 'signed' });
    if (!resolved.ok) throw new Error(resolved.error.message);
    return resolved.data.asset.url;
  }

  private getStorage(projectId: string) {
    return this.resolveStorage({
      projectId,
      projectManager: this.projectManager,
      workspaceRoot: this.workspaceRoot,
    });
  }
}

export function createAuthoringMediaPath(assetId: string, fileName: string): string {
  return `authoring/${sanitizeSegment(assetId)}/${sanitizeFileName(fileName)}`;
}

function sanitizeSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'media';
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^\.+/, '');
  return normalized || 'asset';
}
