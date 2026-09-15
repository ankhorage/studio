import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { isMissingPathError, writeJsonFileAtomic } from '@ankhorage/utility/node/fs';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

import { createStudioRuntimeSyncSignature } from '../../manifestSync';
import type { StudioRuntimeProjectionState } from '../../types/project-generation';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';

interface PersistedRuntimeProjectionFailure {
  readonly code: 'runtime-projection-failed';
  readonly at: string;
}

interface PersistedRuntimeProjection {
  readonly desiredSignature: string;
  readonly appliedSignature?: string;
  readonly failure?: PersistedRuntimeProjectionFailure;
}

interface ProjectGenerationState {
  readonly includeStudio: boolean;
  readonly runtimeProjection?: PersistedRuntimeProjection;
}

/*** Persist and inspect Studio-owned generated-project state without conflating manifest persistence with projection currency. */
export class ProjectGenerationStateStore {
  /*** Read whether the current generated project state includes the Studio admin surface. */
  async readStudioInclusionAsync(projectPath: string): Promise<boolean> {
    return (await this.readRequiredStateAsync(projectPath)).includeStudio;
  }

  /*** Persist Studio inclusion while preserving any existing runtime-projection evidence. */
  async writeStudioInclusionAsync(projectPath: string, includeStudio: boolean): Promise<void> {
    const current = await this.readOptionalStateAsync(projectPath);
    await this.writeStateAsync(projectPath, {
      ...(current ?? {}),
      includeStudio,
    });
  }

  /*** Inspect current manifest runtime currency against durable generated-project evidence without writing project state. */
  async inspectRuntimeProjectionAsync(
    projectPath: string,
    manifest: AppManifest,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.readOptionalStateAsync(projectPath);
    return this.toRuntimeProjectionState(manifest, state?.runtimeProjection);
  }

  /*** Record a manifest-only persistence and mark runtime projection pending when its runtime-relevant fingerprint changed. */
  async recordManifestPersistenceAsync(
    projectPath: string,
    manifest: AppManifest,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.readRequiredStateAsync(projectPath);
    const desiredSignature = createRuntimeProjectionSignature(manifest);
    const current = state.runtimeProjection;
    if (current?.desiredSignature === desiredSignature) {
      return this.toRuntimeProjectionState(manifest, current);
    }

    const runtimeProjection: PersistedRuntimeProjection = {
      desiredSignature,
      ...(current?.appliedSignature ? { appliedSignature: current.appliedSignature } : {}),
    };
    await this.writeStateAsync(projectPath, { ...state, runtimeProjection });
    return this.toRuntimeProjectionState(manifest, runtimeProjection);
  }

  /*** Mark runtime projection current only after the owning generation operation completed successfully. */
  async recordRuntimeProjectionCurrentAsync(
    projectPath: string,
    manifest: AppManifest,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.readRequiredStateAsync(projectPath);
    const signature = createRuntimeProjectionSignature(manifest);
    const runtimeProjection: PersistedRuntimeProjection = {
      desiredSignature: signature,
      appliedSignature: signature,
    };
    await this.writeStateAsync(projectPath, { ...state, runtimeProjection });
    return this.toRuntimeProjectionState(manifest, runtimeProjection);
  }

  /*** Persist non-sensitive failure evidence for the exact runtime fingerprint whose projection failed. */
  async recordRuntimeProjectionFailureAsync(
    projectPath: string,
    manifest: AppManifest,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.readRequiredStateAsync(projectPath);
    const desiredSignature = createRuntimeProjectionSignature(manifest);
    const current = state.runtimeProjection;
    const runtimeProjection: PersistedRuntimeProjection = {
      desiredSignature,
      ...(current?.appliedSignature ? { appliedSignature: current.appliedSignature } : {}),
      failure: {
        code: 'runtime-projection-failed',
        at: new Date().toISOString(),
      },
    };
    await this.writeStateAsync(projectPath, { ...state, runtimeProjection });
    return this.toRuntimeProjectionState(manifest, runtimeProjection);
  }

  /*** Derive public runtime projection state from the current manifest and optional durable evidence. */
  private toRuntimeProjectionState(
    manifest: AppManifest,
    runtimeProjection: PersistedRuntimeProjection | undefined,
  ): StudioRuntimeProjectionState {
    const desiredSignature = createRuntimeProjectionSignature(manifest);
    if (!runtimeProjection) {
      return {
        status: 'unknown',
        desiredSignature,
        appliedSignature: null,
      };
    }

    const appliedSignature = runtimeProjection.appliedSignature ?? null;
    if (appliedSignature === desiredSignature) {
      return {
        status: 'current',
        desiredSignature,
        appliedSignature,
      };
    }
    if (
      runtimeProjection.desiredSignature === desiredSignature &&
      runtimeProjection.failure !== undefined
    ) {
      return {
        status: 'failed',
        desiredSignature,
        appliedSignature,
        failure: runtimeProjection.failure,
      };
    }
    return {
      status: 'pending',
      desiredSignature,
      appliedSignature,
    };
  }

  /*** Read required generated-project state and reject missing evidence needed for a write transition. */
  private async readRequiredStateAsync(projectPath: string): Promise<ProjectGenerationState> {
    const state = await this.readOptionalStateAsync(projectPath);
    if (state) return state;
    throw new Error(
      `Project generation state is missing at '${resolveStatePath(projectPath)}'. Run an explicit project sync with includeStudio set before using implicit runtime sync.`,
    );
  }

  /*** Read generated-project state when present while accepting legacy current-schema files without runtime projection evidence. */
  private async readOptionalStateAsync(projectPath: string): Promise<ProjectGenerationState | null> {
    const statePath = resolveStatePath(projectPath);
    try {
      const source = await fs.readFile(statePath, 'utf8');
      return parseProjectGenerationState(source, statePath);
    } catch (error) {
      if (isMissingPathError(error)) return null;
      throw error;
    }
  }

  /*** Atomically write one complete generated-project state document. */
  private async writeStateAsync(projectPath: string, state: ProjectGenerationState): Promise<void> {
    await writeJsonFileAtomic(resolveStatePath(projectPath), state);
  }
}

/*** Resolve the canonical generated-project state path beneath a project root. */
function resolveStatePath(projectPath: string): string {
  const root = path.resolve(projectPath);
  const target = path.resolve(root, PROJECT_GENERATION_STATE_REL_PATH);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid project generation state path: ${PROJECT_GENERATION_STATE_REL_PATH}`);
  }
  return target;
}

/*** Parse and validate one generated-project state document. */
function parseProjectGenerationState(source: string, statePath: string): ProjectGenerationState {
  const parsed = parseJson(source, statePath);
  if (!isProjectGenerationState(parsed)) {
    throw new Error(`Project generation state is invalid at '${statePath}'.`);
  }
  return parsed;
}

/*** Parse JSON while preserving generated-project state path context on syntax errors. */
function parseJson(source: string, statePath: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`Project generation state is invalid at '${statePath}'.`, { cause: error });
  }
}

/*** Validate the semantic shape of a persisted generated-project state document. */
function isProjectGenerationState(value: unknown): value is ProjectGenerationState {
  if (!isRecord(value)) return false;
  if (typeof readOwnProperty(value, 'includeStudio') !== 'boolean') return false;
  const runtimeProjection = readOwnProperty(value, 'runtimeProjection');
  return runtimeProjection === undefined || isPersistedRuntimeProjection(runtimeProjection);
}

/*** Validate optional persisted runtime projection evidence. */
function isPersistedRuntimeProjection(value: unknown): value is PersistedRuntimeProjection {
  if (!isRecord(value)) return false;
  const desiredSignature = readOwnProperty(value, 'desiredSignature');
  const appliedSignature = readOwnProperty(value, 'appliedSignature');
  const failure = readOwnProperty(value, 'failure');
  return (
    typeof desiredSignature === 'string' &&
    (appliedSignature === undefined || typeof appliedSignature === 'string') &&
    (failure === undefined || isPersistedRuntimeProjectionFailure(failure))
  );
}

/*** Validate bounded non-sensitive runtime projection failure evidence. */
function isPersistedRuntimeProjectionFailure(
  value: unknown,
): value is PersistedRuntimeProjectionFailure {
  return (
    isRecord(value) &&
    readOwnProperty(value, 'code') === 'runtime-projection-failed' &&
    typeof readOwnProperty(value, 'at') === 'string'
  );
}

/*** Hash only Studio's runtime-relevant manifest signature into bounded generated-project evidence. */
function createRuntimeProjectionSignature(manifest: AppManifest): string {
  return createHash('sha256').update(createStudioRuntimeSyncSignature(manifest), 'utf8').digest('hex');
}
