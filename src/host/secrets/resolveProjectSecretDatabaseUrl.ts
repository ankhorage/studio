import { promises as fs } from 'fs';
import path from 'path';

const DATABASE_URL_KEYS = [
  'ANKH_SECRET_STORE_DATABASE_URL',
  'SUPABASE_DB_URL',
  'POSTGRES_URL',
  'DB_URL',
  'DATABASE_URL',
] as const;

export interface ResolveProjectSecretDatabaseUrlInput {
  readonly projectPath: string;
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
}

/**
 * Resolves the trusted database bootstrap URL without consulting the app manifest.
 *
 * Project-local values are read only from the generated, untracked Minikube environment file.
 * There is deliberately no plaintext project-file fallback.
 */
export async function resolveProjectSecretDatabaseUrl(
  input: ResolveProjectSecretDatabaseUrlInput,
): Promise<string> {
  const processEnvironment = input.processEnvironment ?? process.env;
  const processValue = readFirstValue(processEnvironment);
  if (processValue) return processValue;

  const envFile = path.join(input.projectPath, 'infra', 'minikube', '.env');
  const projectEnvironment = await readEnvFile(envFile);
  const projectValue = readFirstValue(projectEnvironment);
  if (projectValue) return projectValue;

  throw new Error(
    'Supabase Vault database access is not configured. Run the generated local Supabase bootstrap or set ANKH_SECRET_STORE_DATABASE_URL in the trusted Studio host environment.',
  );
}

function readFirstValue(environment: Readonly<Record<string, string | undefined>>): string | null {
  for (const key of DATABASE_URL_KEYS) {
    const value = environment[key]?.trim();
    if (value) return value;
  }

  return null;
}

async function readEnvFile(filePath: string): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const environment: Record<string, string> = {};

    for (const line of content.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator <= 0) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, '');
      environment[key] = value;
    }

    return environment;
  } catch (error) {
    if (isMissingFileError(error)) return {};
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
