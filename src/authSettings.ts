import { DEFAULT_AUTH_FLOW, type AppManifest } from '@ankhorage/contracts';
import { normalizeSecretRef } from '@ankhorage/contracts/secrets';
import {
  getSupabaseOAuthProviderDefinition,
  type SupabaseOAuthProviderId,
} from '@ankhorage/supabase-auth';

type ManifestAuth = NonNullable<AppManifest['infra']['auth']>;
type ManifestFlow = NonNullable<ManifestAuth['flow']>;
type ManifestSignIn = NonNullable<ManifestAuth['signIn']>;
type ManifestSignUp = NonNullable<ManifestAuth['signUp']>;
type ManifestOAuth = NonNullable<ManifestAuth['oauth']>;
type ManifestOAuthProvider = ManifestOAuth['providers'][number];
type ManifestProfile = NonNullable<ManifestAuth['profile']>;

export interface StudioAuthSettings {
  readonly scope: ManifestAuth['scope'];
  readonly provider: ManifestAuth['provider'];
  readonly flow: ManifestFlow;
  readonly signIn: ManifestSignIn;
  readonly signUp?: ManifestSignUp;
  readonly oauth?: ManifestOAuth;
  readonly profile?: ManifestProfile;
}

export type StudioAuthSettingsValidationResult =
  | { readonly ok: true; readonly data: StudioAuthSettings }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'invalid_config';
        readonly message: string;
      };
    };

const AUTH_SCOPES = new Set(['global', 'none', 'integrated']);
const AUTH_IDENTIFIERS = new Set(['email', 'phone', 'username']);
const AUTH_SIGN_UP_FIELDS = new Set([
  'email',
  'phone',
  'username',
  'password',
  'displayName',
  'firstName',
  'lastName',
]);
const AUTH_SIGN_UP_POLICIES = new Set(['autoSignIn', 'requireVerification']);
const AUTH_PROFILE_FIELDS = new Set([
  'email',
  'phone',
  'username',
  'firstName',
  'lastName',
  'displayName',
  'avatarUrl',
]);
const PROFILE_CREATE_STRATEGIES = new Set(['trigger', 'api', 'app']);
const PROFILE_UPDATE_STRATEGIES = new Set(['api', 'app']);
const FORBIDDEN_INLINE_SECRET_KEYS = new Set([
  'apikey',
  'clientid',
  'clientsecret',
  'credentials',
  'databasepassword',
  'password',
  'payload',
  'privatekey',
  'secret',
  'secretvalue',
  'servicerolekey',
  'token',
]);

export function readStudioAuthSettings(manifest: AppManifest): StudioAuthSettings | null {
  const auth = manifest.infra.auth;
  if (!auth) return null;

  return {
    scope: auth.scope,
    provider: auth.provider,
    flow: { ...(auth.flow ?? DEFAULT_AUTH_FLOW) },
    signIn: { identifiers: [...(auth.signIn?.identifiers ?? ['email'])] },
    ...(auth.signUp
      ? {
          signUp: {
            requiredFields: [...auth.signUp.requiredFields],
            ...(auth.signUp.optionalFields
              ? { optionalFields: [...auth.signUp.optionalFields] }
              : {}),
            ...(auth.signUp.signUpPolicy ? { signUpPolicy: auth.signUp.signUpPolicy } : {}),
          },
        }
      : {}),
    ...(auth.oauth
      ? {
          oauth: {
            enabled: auth.oauth.enabled,
            callbackRoute: auth.oauth.callbackRoute,
            providers: auth.oauth.providers.map(cloneOAuthProvider),
          },
        }
      : {}),
    ...(auth.profile
      ? {
          profile: {
            fields: [...auth.profile.fields],
            ...(auth.profile.table ? { table: auth.profile.table } : {}),
            ...(auth.profile.primaryKey ? { primaryKey: auth.profile.primaryKey } : {}),
            ...(auth.profile.createStrategy
              ? { createStrategy: auth.profile.createStrategy }
              : {}),
            ...(auth.profile.updateStrategy
              ? { updateStrategy: auth.profile.updateStrategy }
              : {}),
          },
        }
      : {}),
  };
}

export function applyStudioAuthSettings(
  manifest: AppManifest,
  settings: StudioAuthSettings,
): AppManifest {
  const currentAuthorization = manifest.infra.auth?.authorization;

  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      auth: {
        scope: settings.scope,
        provider: settings.provider,
        flow: { ...settings.flow },
        signIn: { identifiers: [...settings.signIn.identifiers] },
        ...(settings.signUp
          ? {
              signUp: {
                requiredFields: [...settings.signUp.requiredFields],
                ...(settings.signUp.optionalFields
                  ? { optionalFields: [...settings.signUp.optionalFields] }
                  : {}),
                ...(settings.signUp.signUpPolicy
                  ? { signUpPolicy: settings.signUp.signUpPolicy }
                  : {}),
              },
            }
          : {}),
        ...(settings.oauth
          ? {
              oauth: {
                enabled: settings.oauth.enabled,
                callbackRoute: settings.oauth.callbackRoute,
                providers: settings.oauth.providers.map(cloneOAuthProvider),
              },
            }
          : {}),
        ...(settings.profile
          ? {
              profile: {
                fields: [...settings.profile.fields],
                ...(settings.profile.table ? { table: settings.profile.table } : {}),
                ...(settings.profile.primaryKey
                  ? { primaryKey: settings.profile.primaryKey }
                  : {}),
                ...(settings.profile.createStrategy
                  ? { createStrategy: settings.profile.createStrategy }
                  : {}),
                ...(settings.profile.updateStrategy
                  ? { updateStrategy: settings.profile.updateStrategy }
                  : {}),
              },
            }
          : {}),
        ...(currentAuthorization ? { authorization: currentAuthorization } : {}),
      },
    },
  };
}

export function validateStudioAuthSettings(value: unknown): StudioAuthSettingsValidationResult {
  const forbiddenPath = findForbiddenInlineSecretPath(value);
  if (forbiddenPath) {
    return invalid(`Auth configuration cannot contain inline secret field "${forbiddenPath}".`);
  }

  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['scope', 'provider', 'flow', 'signIn', 'signUp', 'oauth', 'profile'])) {
    return invalid('Auth configuration contains unsupported fields.');
  }

  if (typeof record.scope !== 'string' || !AUTH_SCOPES.has(record.scope)) {
    return invalid('Auth scope must be global, none, or integrated.');
  }
  if (record.provider !== 'supabase') {
    return invalid('The current Studio auth provider must be supabase.');
  }

  const flow = parseFlow(record.flow);
  if (!flow.ok) return flow;
  const signIn = parseSignIn(record.signIn);
  if (!signIn.ok) return signIn;
  const signUp = record.signUp === undefined ? undefined : parseSignUp(record.signUp);
  if (signUp && !signUp.ok) return signUp;
  const oauth = record.oauth === undefined ? undefined : parseOAuth(record.oauth);
  if (oauth && !oauth.ok) return oauth;
  const profile = record.profile === undefined ? undefined : parseProfile(record.profile);
  if (profile && !profile.ok) return profile;

  return {
    ok: true,
    data: {
      scope: record.scope as ManifestAuth['scope'],
      provider: 'supabase',
      flow: flow.data,
      signIn: signIn.data,
      ...(signUp ? { signUp: signUp.data } : {}),
      ...(oauth ? { oauth: oauth.data } : {}),
      ...(profile ? { profile: profile.data } : {}),
    },
  };
}

function parseFlow(value: unknown): StudioAuthSettingsValidationResult & { data?: ManifestFlow } {
  const record = asRecord(value);
  const keys = [
    'signInRoute',
    'signUpRoute',
    'signOutRoute',
    'forgotPasswordRoute',
    'otpRoute',
    'postSignInRoute',
    'unauthorizedRoute',
  ];
  if (!record || !hasOnlyKeys(record, keys)) return invalid('Auth flow contains unsupported fields.');

  const signInRoute = readRoute(record.signInRoute, 'signInRoute');
  if (!signInRoute.ok) return signInRoute;
  const postSignInRoute = readRoute(record.postSignInRoute, 'postSignInRoute');
  if (!postSignInRoute.ok) return postSignInRoute;

  const optionalRoutes = [
    'signUpRoute',
    'signOutRoute',
    'forgotPasswordRoute',
    'otpRoute',
    'unauthorizedRoute',
  ] as const;
  const parsed: Record<string, string> = {};
  for (const key of optionalRoutes) {
    if (record[key] === undefined) continue;
    const route = readRoute(record[key], key);
    if (!route.ok) return route;
    parsed[key] = route.data;
  }

  return {
    ok: true,
    data: {
      signInRoute: signInRoute.data,
      postSignInRoute: postSignInRoute.data,
      ...parsed,
    },
  } as StudioAuthSettingsValidationResult & { data: ManifestFlow };
}

function parseSignIn(value: unknown): StudioAuthSettingsValidationResult & { data?: ManifestSignIn } {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['identifiers'])) {
    return invalid('Sign-in configuration contains unsupported fields.');
  }
  const identifiers = readStringArray(record.identifiers, 'Sign-in identifiers', AUTH_IDENTIFIERS);
  if (!identifiers.ok) return identifiers;
  if (identifiers.data.length === 0) return invalid('At least one sign-in identifier is required.');
  return {
    ok: true,
    data: { identifiers: identifiers.data as ManifestSignIn['identifiers'] },
  } as StudioAuthSettingsValidationResult & { data: ManifestSignIn };
}

function parseSignUp(value: unknown): StudioAuthSettingsValidationResult & { data?: ManifestSignUp } {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['requiredFields', 'optionalFields', 'signUpPolicy'])) {
    return invalid('Sign-up configuration contains unsupported fields.');
  }
  const required = readStringArray(record.requiredFields, 'Required sign-up fields', AUTH_SIGN_UP_FIELDS);
  if (!required.ok) return required;
  if (required.data.length === 0) return invalid('Enabled sign-up requires at least one required field.');
  const optional =
    record.optionalFields === undefined
      ? undefined
      : readStringArray(record.optionalFields, 'Optional sign-up fields', AUTH_SIGN_UP_FIELDS);
  if (optional && !optional.ok) return optional;
  if (
    record.signUpPolicy !== undefined &&
    (typeof record.signUpPolicy !== 'string' || !AUTH_SIGN_UP_POLICIES.has(record.signUpPolicy))
  ) {
    return invalid('Sign-up policy must be autoSignIn or requireVerification.');
  }

  return {
    ok: true,
    data: {
      requiredFields: required.data as ManifestSignUp['requiredFields'],
      ...(optional ? { optionalFields: optional.data as ManifestSignUp['optionalFields'] } : {}),
      ...(typeof record.signUpPolicy === 'string'
        ? { signUpPolicy: record.signUpPolicy as NonNullable<ManifestSignUp['signUpPolicy']> }
        : {}),
    },
  } as StudioAuthSettingsValidationResult & { data: ManifestSignUp };
}

function parseOAuth(value: unknown): StudioAuthSettingsValidationResult & { data?: ManifestOAuth } {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['enabled', 'callbackRoute', 'providers'])) {
    return invalid('OAuth configuration contains unsupported fields.');
  }
  if (typeof record.enabled !== 'boolean') return invalid('OAuth enabled must be a boolean.');
  const callbackRoute = readCallbackRoute(record.callbackRoute);
  if (!callbackRoute.ok) return callbackRoute;
  if (!Array.isArray(record.providers)) return invalid('OAuth providers must be an array.');

  const providers: ManifestOAuthProvider[] = [];
  const providerIds = new Set<string>();
  const credentialRefs = new Map<string, string>();
  for (const value of record.providers) {
    const provider = parseOAuthProvider(value);
    if (!provider.ok) return provider;
    if (providerIds.has(provider.data.id)) {
      return invalid(`OAuth provider "${provider.data.id}" is configured more than once.`);
    }
    providerIds.add(provider.data.id);
    if (provider.data.credentialsRef) {
      const owner = credentialRefs.get(provider.data.credentialsRef);
      if (owner && owner !== provider.data.id) {
        return invalid(`Secret reference "${provider.data.credentialsRef}" is shared by incompatible providers.`);
      }
      credentialRefs.set(provider.data.credentialsRef, provider.data.id);
    }
    providers.push(provider.data);
  }

  return {
    ok: true,
    data: { enabled: record.enabled, callbackRoute: callbackRoute.data, providers },
  } as StudioAuthSettingsValidationResult & { data: ManifestOAuth };
}

function parseOAuthProvider(
  value: unknown,
): StudioAuthSettingsValidationResult & { data?: ManifestOAuthProvider } {
  const record = asRecord(value);
  if (
    !record ||
    !hasOnlyKeys(record, [
      'id',
      'label',
      'enabled',
      'scopes',
      'redirectTo',
      'queryParams',
      'icon',
      'credentialsRef',
    ])
  ) {
    return invalid('OAuth provider configuration contains unsupported fields.');
  }
  if (typeof record.id !== 'string') return invalid('OAuth provider id is required.');
  const definition = getSupabaseOAuthProviderDefinition(record.id);
  if (!definition) return invalid(`OAuth provider "${record.id}" is not supported.`);
  if (record.enabled !== undefined && typeof record.enabled !== 'boolean') {
    return invalid('OAuth provider enabled must be a boolean.');
  }
  if (record.label !== undefined && typeof record.label !== 'string') {
    return invalid('OAuth provider label must be a string.');
  }
  const scopes =
    record.scopes === undefined ? undefined : readStringArray(record.scopes, 'OAuth scopes');
  if (scopes && !scopes.ok) return scopes;
  if (record.redirectTo !== undefined && typeof record.redirectTo !== 'string') {
    return invalid('OAuth redirectTo must be a string.');
  }
  const queryParams = readOptionalStringRecord(record.queryParams, 'OAuth queryParams');
  if (!queryParams.ok) return queryParams;
  const icon = readOptionalIcon(record.icon);
  if (!icon.ok) return icon;

  let credentialsRef: string | undefined;
  if (record.credentialsRef !== undefined) {
    if (typeof record.credentialsRef !== 'string') {
      return invalid('OAuth credentialsRef must be a string.');
    }
    const normalized = normalizeSecretRef(record.credentialsRef);
    if (!normalized.ok) return invalid(normalized.error.message);
    credentialsRef = normalized.data;
  }
  if (record.enabled === true && !credentialsRef) {
    return invalid(`Enabled OAuth provider "${record.id}" requires credentialsRef.`);
  }

  return {
    ok: true,
    data: {
      id: definition.id as SupabaseOAuthProviderId,
      ...(typeof record.label === 'string' && record.label.trim()
        ? { label: record.label.trim() }
        : {}),
      ...(typeof record.enabled === 'boolean' ? { enabled: record.enabled } : {}),
      ...(scopes ? { scopes: scopes.data } : {}),
      ...(typeof record.redirectTo === 'string' && record.redirectTo.trim()
        ? { redirectTo: record.redirectTo.trim() }
        : {}),
      ...(queryParams.data ? { queryParams: queryParams.data } : {}),
      ...(icon.data ? { icon: icon.data } : {}),
      ...(credentialsRef ? { credentialsRef } : {}),
    },
  } as StudioAuthSettingsValidationResult & { data: ManifestOAuthProvider };
}

function parseProfile(value: unknown): StudioAuthSettingsValidationResult & { data?: ManifestProfile } {
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['fields', 'table', 'primaryKey', 'createStrategy', 'updateStrategy'])) {
    return invalid('Profile configuration contains unsupported fields.');
  }
  const fields = readStringArray(record.fields, 'Profile fields', AUTH_PROFILE_FIELDS);
  if (!fields.ok) return fields;
  if (fields.data.some((field) => field.toLowerCase() === 'role')) {
    return invalid('Profile configuration cannot add a role field in Phase 2.');
  }
  if (record.table !== undefined) {
    if (typeof record.table !== 'string' || !record.table.trim()) {
      return invalid('Profile table must be a non-empty string.');
    }
    if (record.table.trim().toLowerCase() === 'users') {
      return invalid('Profile table cannot be named users.');
    }
  }
  if (record.primaryKey !== undefined && record.primaryKey !== 'authUserId') {
    return invalid('Profile primaryKey must be authUserId.');
  }
  if (
    record.createStrategy !== undefined &&
    (typeof record.createStrategy !== 'string' || !PROFILE_CREATE_STRATEGIES.has(record.createStrategy))
  ) {
    return invalid('Profile createStrategy must be trigger, api, or app.');
  }
  if (
    record.updateStrategy !== undefined &&
    (typeof record.updateStrategy !== 'string' || !PROFILE_UPDATE_STRATEGIES.has(record.updateStrategy))
  ) {
    return invalid('Profile updateStrategy must be api or app.');
  }

  return {
    ok: true,
    data: {
      fields: fields.data,
      ...(typeof record.table === 'string' ? { table: record.table.trim() } : {}),
      ...(record.primaryKey === 'authUserId' ? { primaryKey: 'authUserId' as const } : {}),
      ...(typeof record.createStrategy === 'string'
        ? { createStrategy: record.createStrategy as NonNullable<ManifestProfile['createStrategy']> }
        : {}),
      ...(typeof record.updateStrategy === 'string'
        ? { updateStrategy: record.updateStrategy as NonNullable<ManifestProfile['updateStrategy']> }
        : {}),
    },
  } as StudioAuthSettingsValidationResult & { data: ManifestProfile };
}

function cloneOAuthProvider(provider: ManifestOAuthProvider): ManifestOAuthProvider {
  return {
    ...provider,
    ...(provider.scopes ? { scopes: [...provider.scopes] } : {}),
    ...(provider.queryParams ? { queryParams: { ...provider.queryParams } } : {}),
    ...(provider.icon ? { icon: { ...provider.icon } } : {}),
  };
}

function readRoute(
  value: unknown,
  field: string,
): StudioAuthSettingsValidationResult & { data?: string } {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const route = value.trim();
  if (!route || route.includes('://') || route.includes('?') || route.includes('#')) {
    return invalid(`${field} must be an application route without URL, query, or hash syntax.`);
  }
  return { ok: true, data: route } as StudioAuthSettingsValidationResult & { data: string };
}

function readCallbackRoute(
  value: unknown,
): StudioAuthSettingsValidationResult & { data?: string } {
  if (typeof value !== 'string') return invalid('OAuth callbackRoute must be a string.');
  const route = value.trim();
  if (!route.startsWith('/') || route.includes('://') || route.includes('?') || route.includes('#')) {
    return invalid('OAuth callbackRoute must be an absolute app path without query or hash syntax.');
  }
  return { ok: true, data: route } as StudioAuthSettingsValidationResult & { data: string };
}

function readStringArray(
  value: unknown,
  label: string,
  allowed?: ReadonlySet<string>,
): StudioAuthSettingsValidationResult & { data?: string[] } {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return invalid(`${label} must be a string array.`);
  }
  const normalized = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (allowed && normalized.some((entry) => !allowed.has(entry))) {
    return invalid(`${label} contains an unsupported value.`);
  }
  return { ok: true, data: normalized } as StudioAuthSettingsValidationResult & { data: string[] };
}

function readOptionalStringRecord(
  value: unknown,
  label: string,
): StudioAuthSettingsValidationResult & { data?: Record<string, string> | undefined } {
  if (value === undefined) {
    return { ok: true, data: undefined } as StudioAuthSettingsValidationResult & {
      data: undefined;
    };
  }
  const record = asRecord(value);
  if (!record || Object.values(record).some((entry) => typeof entry !== 'string')) {
    return invalid(`${label} must contain only string values.`);
  }
  return {
    ok: true,
    data: Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, String(entry)])),
  } as StudioAuthSettingsValidationResult & { data: Record<string, string> };
}

function readOptionalIcon(
  value: unknown,
): StudioAuthSettingsValidationResult & { data?: ManifestOAuthProvider['icon'] | undefined } {
  if (value === undefined) {
    return { ok: true, data: undefined } as StudioAuthSettingsValidationResult & {
      data: undefined;
    };
  }
  const record = asRecord(value);
  if (!record || !hasOnlyKeys(record, ['name', 'provider', 'size', 'color']) || typeof record.name !== 'string') {
    return invalid('OAuth provider icon is invalid.');
  }
  if (record.provider !== undefined && typeof record.provider !== 'string') {
    return invalid('OAuth provider icon provider must be a string.');
  }
  if (record.size !== undefined && typeof record.size !== 'string' && typeof record.size !== 'number') {
    return invalid('OAuth provider icon size must be a string or number.');
  }
  if (record.color !== undefined && typeof record.color !== 'string') {
    return invalid('OAuth provider icon color must be a string.');
  }
  return {
    ok: true,
    data: {
      name: record.name,
      ...(typeof record.provider === 'string' ? { provider: record.provider } : {}),
      ...(typeof record.size === 'string' || typeof record.size === 'number'
        ? { size: record.size }
        : {}),
      ...(typeof record.color === 'string' ? { color: record.color } : {}),
    },
  } as StudioAuthSettingsValidationResult & { data: NonNullable<ManifestOAuthProvider['icon']> };
}

function findForbiddenInlineSecretPath(value: unknown, parent = ''): string | null {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findForbiddenInlineSecretPath(entry, `${parent}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const [key, entry] of Object.entries(record)) {
    const path = parent ? `${parent}.${key}` : key;
    const normalizedKey = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
    if (FORBIDDEN_INLINE_SECRET_KEYS.has(normalizedKey)) return path;
    const found = findForbiddenInlineSecretPath(entry, path);
    if (found) return found;
  }
  return null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(record).every((key) => allowedSet.has(key));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalid(message: string): StudioAuthSettingsValidationResult {
  return { ok: false, error: { code: 'invalid_config', message } };
}
