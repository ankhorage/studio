import type { MediaAsset, MediaAssetKind } from '@ankhorage/contracts';

import { getProjectPath } from '../orchestrator/projectPaths';
import { writeProjectAuthoringAsset } from './projectAuthoringAssetWriter';
import { syncProjectBundledMediaRegistry } from './projectBundledMediaRegistry';

export interface ProjectBundledMediaInput {
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

export class ProjectBundledMediaService {
  constructor(private readonly workspaceRoot: string) {}

  async bundle(projectId: string, input: ProjectBundledMediaInput): Promise<MediaAsset> {
    const projectPath = getProjectPath(this.workspaceRoot, projectId);
    const bundledPath = createBundledAuthoringMediaPath(input.assetId, input.name);
    await writeProjectAuthoringAsset(projectPath, bundledPath, input.body);
    await syncProjectBundledMediaRegistry(projectPath);

    return {
      id: input.assetId,
      name: input.name,
      kind: input.kind,
      source: { kind: 'bundled', path: bundledPath },
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
}

export function createBundledAuthoringMediaPath(assetId: string, fileName: string): string {
  return `assets/authoring/${sanitizeSegment(assetId)}/${sanitizeFileName(fileName)}`;
}

function sanitizeSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'media'
  );
}

function sanitizeFileName(value: string): string {
  const baseName = value.trim().split(/[\\/]/).pop() ?? '';
  const normalized = baseName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^\.+/, '');
  return normalized || 'asset';
}
