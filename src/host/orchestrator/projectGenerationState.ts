import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';

interface ProjectGenerationState {
  readonly schemaVersion: 1;
  readonly includeStudio: boolean;
}

export async function readProjectStudioInclusion(projectPath: string): Promise<boolean> {
  const statePath = resolveProjectFile(projectPath, PROJECT_GENERATION_STATE_REL_PATH);
  const state = await readProjectGenerationState(statePath);
  return state.includeStudio;
}

export async function writeProjectStudioInclusion(
  projectPath: string,
  includeStudio: boolean,
): Promise<void> {
  const state: ProjectGenerationState = { schemaVersion: 1, includeStudio };
  const statePath = resolveProjectFile(projectPath, PROJECT_GENERATION_STATE_REL_PATH);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, statePath);
}

async function readProjectGenerationState(statePath: string): Promise<ProjectGenerationState> {
  let source: string;
  try {
    source = await fs.readFile(statePath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(
        `Project generation state is missing at '${statePath}'. Run an explicit project sync with includeStudio set before using implicit runtime sync.`,
        { cause: error },
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`Project generation state is invalid at '${statePath}'.`, { cause: error });
  }

  if (!isProjectGenerationState(parsed)) {
    throw new Error(`Project generation state is invalid at '${statePath}'.`);
  }
  return parsed;
}

function isProjectGenerationState(value: unknown): value is ProjectGenerationState {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.includeStudio === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveProjectFile(projectPath: string, relativePath: string): string {
  const root = path.resolve(projectPath);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid project generation state path: ${relativePath}`);
  }
  return target;
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
