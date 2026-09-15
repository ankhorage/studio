import { promises as fs } from 'node:fs';
import path from 'node:path';

import { isMissingPathError, writeJsonFileAtomic } from '@ankhorage/utility/node/fs';
import { isRecord } from '@ankhorage/utility/object';

import type {
  ProjectRuntimeProjectionEvidence,
  StudioRuntimeProjectionState,
} from '../../../../types/project-generation';
import { resolveStudioRuntimeProjectionState } from '../../domain/resolveStudioRuntimeProjectionState';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';

interface ProjectGenerationState {
  readonly includeStudio: boolean;
  readonly runtimeProjection?: ProjectRuntimeProjectionEvidence;
}

/*** Persist and inspect Studio-owned generated-project state in the canonical `.ankh/generation-state.json` document. */
export class ProjectGenerationStateStore {
  /*** Read whether the current generated project state includes the Studio admin surface. */
  async readStudioInclusionAsync(projectPath: string): Promise<boolean> {
    const state = await this.requireStateAsync(projectPath);
    return state.includeStudio;
  }

  /*** Atomically persist Studio inclusion while preserving runtime projection evidence owned by the same state document. */
  async writeStudioInclusionAsync(projectPath: string, includeStudio: boolean): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.readStateAsync(statePath, true);
    const state: ProjectGenerationState = current
      ? { ...current, includeStudio }
      : { includeStudio };
    await writeJsonFileAtomic(statePath, state);
  }

  /*** Resolve current runtime projection currency without exposing persisted runtime signatures to callers. */
  async readRuntimeProjectionStateAsync(
    projectPath: string,
    expectedSignature: string,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.requireStateAsync(projectPath);
    return resolveStudioRuntimeProjectionState(state.runtimeProjection, expectedSignature);
  }

  /*** Record the exact runtime signature only after the owning projection operation completed successfully. */
  async recordRuntimeProjectionSuccessAsync(
    projectPath: string,
    appliedSignature: string,
  ): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.requireStateAsync(projectPath);
    await writeJsonFileAtomic(statePath, {
      ...current,
      runtimeProjection: { appliedSignature },
    });
  }

  /*** Persist bounded failure evidence for one attempted runtime signature while retaining the last successful signature. */
  async recordRuntimeProjectionFailureAsync(
    projectPath: string,
    failedSignature: string,
  ): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.requireStateAsync(projectPath);
    const appliedSignature = current.runtimeProjection?.appliedSignature;
    await writeJsonFileAtomic(statePath, {
      ...current,
      runtimeProjection: {
        ...(appliedSignature === undefined ? {} : { appliedSignature }),
        failedSignature,
      },
    });
  }

  /*** Read one required generation-state document and reject missing state instead of inferring ownership. */
  private async requireStateAsync(projectPath: string): Promise<ProjectGenerationState> {
    const state = await this.readStateAsync(this.resolveStatePath(projectPath), false);
    if (!state) throw new Error('Project generation state unexpectedly resolved as missing.');
    return state;
  }

  /*** Read, parse and validate one generation-state document, optionally treating a missing file as an empty owner state. */
  private async readStateAsync(
    statePath: string,
    allowMissing: boolean,
  ): Promise<ProjectGenerationState | null> {
    const source = await this.readStateSourceAsync(statePath, allowMissing);
    if (source === null) return null;
    const parsed = this.parseStateSource(source, statePath);
    if (!this.isProjectGenerationState(parsed)) {
      throw new Error(`Project generation state is invalid at '${statePath}'.`);
    }
    return parsed;
  }

  /*** Read one generation-state source document with explicit missing-state semantics. */
  private async readStateSourceAsync(
    statePath: string,
    allowMissing: boolean,
  ): Promise<string | null> {
    try {
      return await fs.readFile(statePath, 'utf8');
    } catch (error) {
      if (allowMissing && isMissingPathError(error)) return null;
      if (isMissingPathError(error)) {
        throw new Error(
          `Project generation state is missing at '${statePath}'. Run an explicit project sync with includeStudio set before using implicit runtime sync.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  /*** Parse one generation-state JSON source while preserving the original parse error as its cause. */
  private parseStateSource(source: string, statePath: string): unknown {
    try {
      return JSON.parse(source) as unknown;
    } catch (error) {
      throw new Error(`Project generation state is invalid at '${statePath}'.`, { cause: error });
    }
  }

  /*** Validate the semantic shape of Studio's generated-project state document. */
  private isProjectGenerationState(value: unknown): value is ProjectGenerationState {
    return (
      isRecord(value) &&
      typeof value.includeStudio === 'boolean' &&
      (value.runtimeProjection === undefined ||
        this.isRuntimeProjectionEvidence(value.runtimeProjection))
    );
  }

  /*** Validate persisted runtime projection evidence without accepting unrelated or malformed values. */
  private isRuntimeProjectionEvidence(value: unknown): value is ProjectRuntimeProjectionEvidence {
    return (
      isRecord(value) &&
      (value.appliedSignature === undefined || typeof value.appliedSignature === 'string') &&
      (value.failedSignature === undefined || typeof value.failedSignature === 'string') &&
      (typeof value.appliedSignature === 'string' || typeof value.failedSignature === 'string')
    );
  }

  /*** Resolve the canonical project generation-state path while rejecting path escape. */
  private resolveStatePath(projectPath: string): string {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, PROJECT_GENERATION_STATE_REL_PATH);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(
        `Invalid project generation state path: ${PROJECT_GENERATION_STATE_REL_PATH}`,
      );
    }
    return target;
  }
}
