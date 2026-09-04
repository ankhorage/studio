import type { MediaAsset, MediaAssetKind, MediaBundledSource } from '@ankhorage/contracts';
import { sanitizeFileName, sanitizePathSegment } from '@ankhorage/utility/media';

import { getProjectPath } from '../orchestrator/projectPaths';
import { writeProjectAuthoringAsset } from './projectAuthoringAssetWriter';
import { syncProjectBundledMediaRegistry } from './projectBundledMediaRegistry';
import { removeProjectAuthoringAsset } from './removeProjectAuthoringAsset';

export interface ProjectBundledMediaInput {
  readonly assetId: string;
  readonly name: string;
  readonly fileName?: string;
  readonly kind: MediaAssetKind;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
}

/*** Manage media authored as bundled project assets and keep the generated Expo registry synchronized. */
export class ProjectBundledMediaService {
  /*** Construct the bundled-media service for one Studio workspace root. */
  constructor(private readonly workspaceRoot: string) {}

  /*** Write one bundled authoring asset, regenerate its registry, and return canonical media metadata. */
  async bundle(projectId: string, input: ProjectBundledMediaInput): Promise<MediaAsset> {
    const projectPath = getProjectPath(this.workspaceRoot, projectId);
    const fileName = input.fileName ?? input.name;
    const bundledPath = createBundledAuthoringMediaPath(input.assetId, fileName);
    await writeProjectAuthoringAsset(projectPath, bundledPath, input.body);
    await syncProjectBundledMediaRegistry(projectPath);

    return {
      id: input.assetId,
      name: input.name,
      kind: input.kind,
      source: { kind: 'bundled', path: bundledPath },
      contentType: input.contentType,
      metadata: {
        originalFileName: fileName,
        sizeBytes: input.sizeBytes ?? input.body.byteLength,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /*** Remove one bundled authoring asset and regenerate the bundled-media registry. */
  async remove(projectId: string, source: MediaBundledSource): Promise<void> {
    const projectPath = getProjectPath(this.workspaceRoot, projectId);
    await removeProjectAuthoringAsset(projectPath, source.path);
    await syncProjectBundledMediaRegistry(projectPath);
  }
}

/*** Build the bundled project path for one Studio-authored media asset. */
export function createBundledAuthoringMediaPath(assetId: string, fileName: string): string {
  return `assets/authoring/${sanitizePathSegment(assetId, 'media')}/${sanitizeFileName(fileName, 'asset')}`;
}
