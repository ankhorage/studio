import { readOwnProperty } from '@ankhorage/utility/object';

const TRUSTED_HOST_DATABASE_URL_KEY = 'ANKH_SECRET_STORE_DATABASE_URL';

export interface ResolveProjectSecretDatabaseUrlInput {
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
}

/***
 * Resolve the trusted database URL used by the project secret store from the Studio host boundary.
 * Supabase Vault bootstrap SQL access is intentionally not derived from public Infra outputs.
 */
export function resolveProjectSecretDatabaseUrl(
  input: ResolveProjectSecretDatabaseUrlInput = {},
): string {
  const rawTrustedHostValue: unknown =
    (input.processEnvironment
      ? readOwnProperty<string | undefined>(input.processEnvironment, TRUSTED_HOST_DATABASE_URL_KEY)
      : undefined) ?? process.env.ANKH_SECRET_STORE_DATABASE_URL;
  const trustedHostValue =
    typeof rawTrustedHostValue === 'string' ? rawTrustedHostValue.trim() : undefined;
  if (trustedHostValue) return trustedHostValue;

  throw new Error(
    'Supabase Vault database access is not configured. Set ANKH_SECRET_STORE_DATABASE_URL in the trusted Studio host environment.',
  );
}
