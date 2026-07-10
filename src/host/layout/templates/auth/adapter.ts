interface AuthAdapterTemplateOptions {
  readonly localSupabaseUrl?: string;
}

const DEFAULT_LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjEyMzQ1Njc4OTAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTUxNjIzOTAyMn0.UYDs1JMK4NH23zXO1aEDLOO_iUYIrOHwzqDqaea-6FY';

export function getAuthAdapterTs(options: AuthAdapterTemplateOptions = {}) {
  const localSupabaseUrl = options.localSupabaseUrl ?? '';

  return `import type { AuthAdapter, AuthResult, AuthSession, AuthUser } from '@ankhorage/contracts/auth';
import { createSupabaseAuthAdapter } from '@ankhorage/supabase-auth';

import { AUTH_SESSION_STORAGE_KEY, authSessionStorage } from './session';

const generatedLocalSupabaseUrl = '${localSupabaseUrl}';
const generatedLocalSupabaseAnonKey =
  '${DEFAULT_LOCAL_SUPABASE_ANON_KEY}';

function readEnv(name: string): string | undefined {
  const maybeProcess: unknown = 'process' in globalThis ? globalThis.process : undefined;
  if (!maybeProcess || typeof maybeProcess !== 'object' || !('env' in maybeProcess)) {
    return undefined;
  }

  const maybeEnv = maybeProcess.env;
  if (!maybeEnv || typeof maybeEnv !== 'object') {
    return undefined;
  }

  const value = (maybeEnv as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function resolveConfiguredValue(
  primary: string | undefined,
  secondary: string | undefined,
  fallback: string,
): string {
  const configured = primary?.trim() ?? secondary?.trim() ?? '';
  if (configured.length > 0) {
    return configured;
  }

  return fallback;
}

const nodeEnv = readEnv('NODE_ENV') ?? '';
const shouldUseGeneratedLocalSupabaseFallback = nodeEnv !== 'production';
const configuredSupabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL') ?? readEnv('SUPABASE_URL') ?? '';
const configuredSupabaseAnonKey =
  readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? readEnv('SUPABASE_ANON_KEY') ?? '';
const supabaseUrl = resolveConfiguredValue(
  configuredSupabaseUrl,
  undefined,
  shouldUseGeneratedLocalSupabaseFallback ? generatedLocalSupabaseUrl : '',
);
const supabaseAnonKey = resolveConfiguredValue(
  configuredSupabaseAnonKey,
  undefined,
  shouldUseGeneratedLocalSupabaseFallback ? generatedLocalSupabaseAnonKey : '',
);

export const authAdapter: AuthAdapter =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0
    ? createSupabaseAuthAdapter({
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        storage: authSessionStorage,
        storageKey: AUTH_SESSION_STORAGE_KEY,
      })
    : createMissingSupabaseAuthAdapter();

function createMissingSupabaseAuthAdapter(): AuthAdapter {
  const createError = <TData>(): AuthResult<TData> => ({
    ok: false,
    error: {
      code: 'missing-supabase-auth-env',
      message:
        'Supabase Auth environment is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, or run the generated Supabase local env bootstrap before starting the app.',
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
