import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DOCKER_LIST_TIMEOUT_MS = 8_000;
const DOCKER_REMOVE_TIMEOUT_MS = 15_000;
const DOCKER_IMAGE_REMOVE_TIMEOUT_MS = 15_000;
const MINIKUBE_IMAGE_REMOVE_TIMEOUT_MS = 20_000;
const EXEC_MAX_BUFFER = 1024 * 1024;

export interface ProjectSupabaseCleanupResult {
  removedContainers: number;
  warnings: string[];
}

export interface ProjectGeneratedAppImageCleanupResult {
  removedImages: number;
  warnings: string[];
  skipped?: {
    reason: string;
  };
}

export interface CommandRunner {
  run(
    command: string,
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string }>;
}

const defaultCommandRunner: CommandRunner = {
  async run(command, args, timeoutMs) {
    const output = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: EXEC_MAX_BUFFER,
    });

    return {
      stdout: output.stdout,
      stderr: output.stderr,
    };
  },
};

function getSupabaseContainersForProject(args: {
  projectId: string;
  containerNames: string[];
}): string[] {
  const { projectId, containerNames } = args;
  const suffix = `_${projectId}`;

  return containerNames.filter((name) => name.startsWith('supabase_') && name.endsWith(suffix));
}

export async function cleanupProjectGeneratedAppImage(args: {
  projectPath: string;
  target: string;
  runner?: CommandRunner;
}): Promise<ProjectGeneratedAppImageCleanupResult> {
  const { projectPath, target, runner = defaultCommandRunner } = args;

  if (target !== 'minikube') {
    return {
      removedImages: 0,
      warnings: [],
      skipped: {
        reason: `Generated app image cleanup is not implemented for deployment target: ${target}.`,
      },
    };
  }

  const env = await readMinikubeEnv(projectPath);
  const cleanupEnabled = readBooleanEnv(env, 'APP_IMAGE_CLEANUP_ON_DOWN', true);
  if (!cleanupEnabled) {
    return {
      removedImages: 0,
      warnings: [],
      skipped: {
        reason: 'Generated app image cleanup disabled by APP_IMAGE_CLEANUP_ON_DOWN=false.',
      },
    };
  }

  const appImage = env.get('APP_IMAGE')?.trim();
  if (!appImage) {
    return {
      removedImages: 0,
      warnings: ['Skipping generated app image cleanup because APP_IMAGE could not be resolved.'],
    };
  }

  const profile = env.get('MINIKUBE_PROFILE')?.trim() ?? 'minikube';
  const warnings: string[] = [];
  let removedImages = 0;

  if (readBooleanEnv(env, 'APP_IMAGE_CLEANUP_MINIKUBE', true)) {
    const result = await removeMinikubeImage({ appImage, profile, runner });
    removedImages += result.removedImages;
    warnings.push(...result.warnings);
  }

  if (readBooleanEnv(env, 'APP_IMAGE_CLEANUP_DOCKER', true)) {
    const result = await removeDockerImage({ appImage, runner });
    removedImages += result.removedImages;
    warnings.push(...result.warnings);
  }

  return {
    removedImages,
    warnings,
  };
}

export async function stopProjectSupabaseContainers(args: {
  projectId: string;
  runner?: CommandRunner;
}): Promise<ProjectSupabaseCleanupResult> {
  const { projectId, runner = defaultCommandRunner } = args;

  if (!projectId) {
    return {
      removedContainers: 0,
      warnings: [],
    };
  }

  try {
    const listResult = await runner.run(
      'docker',
      ['ps', '-a', '--format', '{{.Names}}'],
      DOCKER_LIST_TIMEOUT_MS,
    );

    const allContainerNames = listResult.stdout
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const supabaseContainers = getSupabaseContainersForProject({
      projectId,
      containerNames: allContainerNames,
    });
    if (supabaseContainers.length === 0) {
      return {
        removedContainers: 0,
        warnings: [],
      };
    }

    try {
      await runner.run('docker', ['rm', '-f', ...supabaseContainers], DOCKER_REMOVE_TIMEOUT_MS);
    } catch (err) {
      throw new Error(`Failed to remove Supabase containers: ${formatError(err)}`, { cause: err });
    }

    return {
      removedContainers: supabaseContainers.length,
      warnings: [],
    };
  } catch (err) {
    if (isMissingCommandError(err)) {
      return {
        removedContainers: 0,
        warnings: ['Skipping Supabase container cleanup because docker is not available in PATH.'],
      };
    }

    throw new Error(`Failed to list Docker containers: ${formatError(err)}`, { cause: err });
  }
}

async function removeMinikubeImage(args: {
  appImage: string;
  profile: string;
  runner: CommandRunner;
}): Promise<ProjectGeneratedAppImageCleanupResult> {
  const { appImage, profile, runner } = args;

  try {
    await runner.run(
      'minikube',
      ['-p', profile, 'image', 'rm', appImage],
      MINIKUBE_IMAGE_REMOVE_TIMEOUT_MS,
    );

    return {
      removedImages: 1,
      warnings: [],
    };
  } catch (err) {
    if (isMissingCommandError(err)) {
      return {
        removedImages: 0,
        warnings: ['Skipping Minikube image cleanup because minikube is not available in PATH.'],
      };
    }

    if (isImageNotFoundError(err)) {
      return {
        removedImages: 0,
        warnings: [],
      };
    }

    return {
      removedImages: 0,
      warnings: [`Skipping Minikube image cleanup for ${appImage}: ${formatError(err)}`],
    };
  }
}

async function removeDockerImage(args: {
  appImage: string;
  runner: CommandRunner;
}): Promise<ProjectGeneratedAppImageCleanupResult> {
  const { appImage, runner } = args;

  try {
    await runner.run('docker', ['image', 'rm', appImage], DOCKER_IMAGE_REMOVE_TIMEOUT_MS);

    return {
      removedImages: 1,
      warnings: [],
    };
  } catch (err) {
    if (isMissingCommandError(err)) {
      return {
        removedImages: 0,
        warnings: ['Skipping Docker image cleanup because docker is not available in PATH.'],
      };
    }

    if (isImageNotFoundError(err)) {
      return {
        removedImages: 0,
        warnings: [],
      };
    }

    return {
      removedImages: 0,
      warnings: [`Skipping Docker image cleanup for ${appImage}: ${formatError(err)}`],
    };
  }
}

async function readMinikubeEnv(projectPath: string): Promise<Map<string, string>> {
  const infraRoot = path.join(projectPath, 'infra', 'minikube');
  const env = new Map<string, string>();

  await mergeEnvFile(env, path.join(infraRoot, '.env.example'));
  await mergeEnvFile(env, path.join(infraRoot, '.env'));

  return env;
}

async function mergeEnvFile(env: Map<string, string>, filePath: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    for (const line of content.split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      env.set(parsed.key, parsed.value);
    }
  } catch (err) {
    if (isMissingFileError(err)) return;
    throw err;
  }
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const assignmentIndex = trimmed.indexOf('=');
  if (assignmentIndex <= 0) return null;

  const key = trimmed.slice(0, assignmentIndex).trim();
  const rawValue = trimmed.slice(assignmentIndex + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, '');

  return { key, value };
}

function readBooleanEnv(env: Map<string, string>, key: string, fallback: boolean): boolean {
  const value = env.get(key)?.trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function isMissingCommandError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybeNodeErr = err as NodeJS.ErrnoException;
  return maybeNodeErr.code === 'ENOENT';
}

function isMissingFileError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const maybeNodeErr = err as NodeJS.ErrnoException;
  return maybeNodeErr.code === 'ENOENT';
}

function isImageNotFoundError(err: unknown): boolean {
  const message = formatError(err);
  return /no such image|image .* not found|not found/i.test(message);
}

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
