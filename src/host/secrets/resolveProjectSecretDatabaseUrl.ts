import { resolveProjectInfrastructureDatabaseUrl } from '@ankhorage/infra/project';

import { readOwnProperty } from '../../utils/readOwnProperty';

const TRUSTED_HOST_DATABASE_URL_KEY = 'ANKH_SECRET_STORE_DATABASE_URL';

export interface ResolveProjectSecretDatabaseUrlInput {
  readonly projectPath: string;
  readonly target: string;
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
}

/***
 * @todo Keep trusted secret-store database resolution with the Secrets host edge; it composes host environment and generated Infra state rather than providing a generic URL helper.
 * Resolve the trusted database URL used by the project secret store, preferring an explicit host override over generated Infra state.
 */
export async function resolveProjectSecretDatabaseUrl(
  input: ResolveProjectSecretDatabaseUrlInput,
): Promise<string> {
  const rawTrustedHostValue: unknown =
    (input.processEnvironment
      ? readOwnProperty<string | undefined>(input.processEnvironment, TRUSTED_HOST_DATABASE_URL_KEY)
      : undefined) ?? process.env.ANKH_SECRET_STORE_DATABASE_URL;
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
