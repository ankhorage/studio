import { resolveProjectInfrastructureDatabaseUrl } from '@ankhorage/infra/project';

const TRUSTED_HOST_DATABASE_URL_KEY = 'ANKH_SECRET_STORE_DATABASE_URL';

export interface ResolveProjectSecretDatabaseUrlInput {
  readonly projectPath: string;
  readonly target: string;
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
}

export async function resolveProjectSecretDatabaseUrl(
  input: ResolveProjectSecretDatabaseUrlInput,
): Promise<string> {
  const rawTrustedHostValue: unknown =
    input.processEnvironment?.[TRUSTED_HOST_DATABASE_URL_KEY] ??
    process.env.ANKH_SECRET_STORE_DATABASE_URL;
  const trustedHostValue =
    typeof rawTrustedHostValue === 'string' ? rawTrustedHostValue.trim() : undefined;
  if (trustedHostValue) return trustedHostValue;

  const projectValue = await resolveProjectInfrastructureDatabaseUrl({
    projectPath: input.projectPath,
    target: input.target,
  });
  if (projectValue) return projectValue;

  throw new Error(
    'Supabase Vault database access is not configured. Run Infra Up or set ANKH_SECRET_STORE_DATABASE_URL in the trusted Studio host environment.',
  );
}
