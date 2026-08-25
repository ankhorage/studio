interface AuthAdapterTemplateOptions {
  readonly oauthProviders?: readonly ('google' | 'apple')[];
}

export function getAuthAdapterTs(options: AuthAdapterTemplateOptions = {}) {
  const oauthProviders = options.oauthProviders ?? [];
  const oauthProviderDeclaration =
    oauthProviders.length > 0
      ? `const generatedOAuthProviders = [${oauthProviders.map((provider) => `'${provider}'`).join(', ')}] as const;\n\n`
      : '';
  const oauthProviderProperty =
    oauthProviders.length > 0 ? '\n        oauthProviders: generatedOAuthProviders,' : '';
  const oauthRandomBytesImport =
    oauthProviders.length > 0 ? "import { getRandomBytes } from 'expo-crypto';" : '';
  const oauthRandomBytesProperty =
    oauthProviders.length > 0 ? '\n        oauthRandomBytes: getRandomBytes,' : '';

  return `import type { AuthAdapter, AuthResult, AuthSession, AuthUser } from '@ankhorage/contracts/auth';
import { createSupabaseAuthAdapter } from '@ankhorage/supabase-auth';
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

export const authAdapter: AuthAdapter =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0
    ? createSupabaseAuthAdapter({
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        storage: authSessionStorage,
        storageKey: AUTH_SESSION_STORAGE_KEY,${oauthProviderProperty}${oauthRandomBytesProperty}
      })
    : createMissingSupabaseAuthAdapter();

function createMissingSupabaseAuthAdapter(): AuthAdapter {
  const createError = <TData>(): AuthResult<TData> => ({
    ok: false,
    error: {
      code: 'missing-supabase-auth-env',
      message:
        'Supabase Auth environment is missing. Run generated Infra Up successfully, verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app .env.local, then restart Expo.',
    },
  });

  return {
    capabilities: {
      signInIdentifiers: ['email'],
      supportsSignUp: true,
      supportsPasswordReset: false,
      supportsOtp: false,
      supportsSessionRefresh: false,
    },
    signIn: () => Promise.resolve(createError<AuthSession>()),
    signUp: () => Promise.resolve(createError<AuthSession | AuthUser>()),
    signOut: () => Promise.resolve(createError()),
    getSession: () => Promise.resolve(createError<AuthSession | null>()),
    refreshSession: () => Promise.resolve(createError<AuthSession | null>()),
  };
}
`;
}
