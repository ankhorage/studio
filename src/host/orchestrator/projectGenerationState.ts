import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';
const LEGACY_STUDIO_ROUTE_REL_PATH = 'src/app/ankh/_layout.tsx';
const LEGACY_STUDIO_DEPENDENCIES = [
  '@react-native-picker/picker',
  'expo-document-picker',
  'expo-image-picker',
] as const;

interface ProjectGenerationState {
  readonly schemaVersion: 1;
  readonly includeStudio: boolean;
}

export async function readProjectStudioInclusion(projectPath: string): Promise<boolean> {
  const stored = await readProjectGenerationState(projectPath);
  if (stored) return stored.includeStudio;

  const includeStudio = await inferLegacyStudioInclusion(projectPath);
  await writeProjectStudioInclusion(projectPath, includeStudio);
  return includeStudio;
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

async function readProjectGenerationState(
  projectPath: string,
): Promise<ProjectGenerationState | null> {
  try {
    const statePath = resolveProjectFile(projectPath, PROJECT_GENERATION_STATE_REL_PATH);
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8')) as unknown;
    if (!isProjectGenerationState(parsed)) return null;
    return parsed;
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

async function inferLegacyStudioInclusion(projectPath: string): Promise<boolean> {
  if (await exists(resolveProjectFile(projectPath, LEGACY_STUDIO_ROUTE_REL_PATH))) return true;

  const packageJson = await readPackageJson(projectPath);
  return LEGACY_STUDIO_DEPENDENCIES.some((dependency) =>
    Object.prototype.hasOwnProperty.call(packageJson?.dependencies ?? {}, dependency),
  );
}

async function readPackageJson(
  projectPath: string,
): Promise<{ readonly dependencies?: Readonly<Record<string, unknown>> } | null> {
  try {
    const packagePath = resolveProjectFile(projectPath, 'package.json');
    const parsed = JSON.parse(await fs.readFile(packagePath, 'utf8')) as unknown;
    if (!isRecord(parsed)) return null;
    const dependencies = isRecord(parsed.dependencies) ? parsed.dependencies : undefined;
    return { dependencies };
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
