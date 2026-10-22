interface AuthAdapterTemplateOptions {
  readonly oauthProviders?: readonly ('google' | 'apple')[];
}

/*** Generate the Supabase-auth adapter module and its missing-environment fallback for a generated app. */
export function getAuthAdapterTs(options: AuthAdapterTemplateOptions = {}) {
  const oauthProviders = options.oauthProviders ?? [];
  const oauthProviderDeclaration =
    oauthProviders.length > 0
      ? `const generatedOAuthProviders = [${oauthProviders.map((provider) => `'${provider}'`).join(', ')}] as const;\n\n`
      : '';
  const oauthProviderProperty =
    oauthProviders.length > 0 ? '\n        oauthProviders: generatedOAuthProviders,' : '';
  const oauthRandomBytesImport =
    oauthProviders.length > 0 ? "import { getRandomBytes } from 'expo-crypto';\n" : '';
  const oauthRandomBytesProperty =
    oauthProviders.length > 0 ? '\n        oauthRandomBytes: getRandomBytes,' : '';

  return `import type { AuthPort } from '@ankhorage/auth';
import { createSupabaseAuthAdapter } from '@ankhorage/auth-supabase';
import type {
  AuthOAuthCompletionResult,
  AuthOAuthStartResult,
  AuthResult,
  AuthSession,
  AuthUser,
} from '@ankhorage/contracts/auth';
${oauthRandomBytesImport}
import { AUTH_SESSION_STORAGE_KEY, authSessionStorage } from './session';

declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

${oauthProviderDeclaration}const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const authAdapter: AuthPort =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0
    ? createSupabaseAuthAdapter({
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        storage: authSessionStorage,
        storageKey: AUTH_SESSION_STORAGE_KEY,${oauthProviderProperty}${oauthRandomBytesProperty}
      })
    : createMissingSupabaseAuthAdapter();

function createMissingSupabaseAuthAdapter(): AuthPort {
  const createError = <TData>(): AuthResult<TData> => ({
    ok: false,
    error: {
      code: 'missing-supabase-auth-env',
      message:
        'Supabase Auth environment is missing. Run generated Infra Up successfully, verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app .env.local, then restart Expo.',
    },
  });

  const createOAuthStartError = (): AuthOAuthStartResult => ({
    ok: false,
    error: {
      code: 'oauth_unavailable',
      message:
        'Supabase OAuth is unavailable because the public Supabase Auth environment is missing.',
      stage: 'start',
      recoverable: true,
    },
  });
  const createOAuthCompletionError = (): AuthOAuthCompletionResult => ({
    ok: false,
    status: 'error',
    error: {
      code: 'oauth_unavailable',
      message:
        'Supabase OAuth is unavailable because the public Supabase Auth environment is missing.',
      stage: 'callback',
      recoverable: true,
    },
  });
  return {
    signIn: () => Promise.resolve(createError<AuthSession>()),
    signUp: () => Promise.resolve(createError<AuthSession | AuthUser>()),
    signOut: () => Promise.resolve(createError()),
    getSession: () => Promise.resolve(createError<AuthSession | null>()),
    refreshSession: () => Promise.resolve(createError<AuthSession | null>()),
    requestPasswordReset: () => Promise.resolve(createError()),
    verifyOtp: () => Promise.resolve(createError<AuthSession>()),
    startAuthorization: () => Promise.resolve(createOAuthStartError()),
    completeAuthorization: () => Promise.resolve(createOAuthCompletionError()),
  };
}
`;
}
