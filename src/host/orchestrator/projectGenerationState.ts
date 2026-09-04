import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';

interface ProjectGenerationState {
  readonly includeStudio: boolean;
}

/***
 * Read whether the current generated project state includes the Studio admin surface.
 * @todo Move generation-state persistence from generic `host/orchestrator` into the `projects/` generation domain.
 */
export async function readProjectStudioInclusion(projectPath: string): Promise<boolean> {
  const statePath = resolveProjectFile(projectPath, PROJECT_GENERATION_STATE_REL_PATH);
  const state = await readProjectGenerationState(statePath);
  return state.includeStudio;
}

/***
 * Atomically persist whether the current generated project state includes the Studio admin surface.
 * @todo Keep this domain wrapper in `projects/`; the generic atomic JSON write primitive can move to Utility.
 */
export async function writeProjectStudioInclusion(
  projectPath: string,
  includeStudio: boolean,
): Promise<void> {
  const state: ProjectGenerationState = { includeStudio };
  const statePath = resolveProjectFile(projectPath, PROJECT_GENERATION_STATE_REL_PATH);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, statePath);
}

/*** Read, parse, and validate the required Studio project-generation state document. */
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

/*** Validate the semantic shape of a persisted Studio project-generation state document. */
function isProjectGenerationState(value: unknown): value is ProjectGenerationState {
  return isRecord(value) && typeof value.includeStudio === 'boolean';
}

/***
 * Narrow an unknown object to a string-keyed record.
 * @utility @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/***
 * Resolve a relative path beneath a root and reject absolute or escaping paths.
 * @utility @ankhorage/utility/node/path
 */
function resolveProjectFile(projectPath: string, relativePath: string): string {
  const root = path.resolve(projectPath);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid project generation state path: ${relativePath}`);
  }
  return target;
}

/***
 * Detect a Node filesystem error indicating that a path does not exist.
 * @utility @ankhorage/utility/node/fs
 */
function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
