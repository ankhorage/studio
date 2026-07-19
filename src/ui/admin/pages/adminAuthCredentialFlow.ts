import type { AuthOAuthProviderConfig, AuthOAuthProviderId } from '@ankhorage/contracts';
import { DEFAULT_AUTH_FLOW } from '@ankhorage/contracts';

import type { StudioAuthSettings, StudioAuthSettingsMutation } from '../../../authSettings';

export interface StoredOAuthCredentialLink {
  readonly providerId: AuthOAuthProviderId;
  readonly providerLabel: string;
  readonly credentialsRef: string;
  readonly providerDefaults: Omit<AuthOAuthProviderConfig, 'credentialsRef' | 'enabled' | 'id'>;
  readonly successMessage: string;
}

export type StoredOAuthCredentialLinkResult =
  | {
      readonly ok: true;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly pendingLink: StoredOAuthCredentialLink;
      readonly message: string;
    };

interface StoredOAuthCredentialRollback {
  readonly providerId: AuthOAuthProviderId;
  readonly credentialsRef: string;
  readonly previousProvider: AuthOAuthProviderConfig | null;
  readonly insertedProvider: AuthOAuthProviderConfig;
}

export async function persistStoredOAuthCredentialLink(args: {
  readonly link: StoredOAuthCredentialLink;
  readonly mutateAuthSettings: (mutation: StudioAuthSettingsMutation) => StudioAuthSettings | null;
  readonly flushManifest: () => Promise<void>;
  readonly refreshHealth: () => Promise<void>;
  readonly toMessage: (error: unknown) => string;
}): Promise<StoredOAuthCredentialLinkResult> {
  let rollback!: StoredOAuthCredentialRollback;
  args.mutateAuthSettings((current) => {
    rollback = createStoredOAuthCredentialRollback(current, args.link);
    return applyStoredOAuthCredentialLink(current, args.link);
  });

  try {
    await args.flushManifest();
  } catch (error) {
    args.mutateAuthSettings((current) => rollbackStoredOAuthCredentialLink(current, rollback));
    return {
      ok: false,
      pendingLink: args.link,
      message: `${args.link.providerLabel} credentials were saved, but the Studio manifest link could not be persisted: ${args.toMessage(error)}`,
    };
  }

  await args.refreshHealth();
  return { ok: true, message: args.link.successMessage };
}

export function patchLocalAuthDraftWithStoredOAuthCredentialLink(
  settings: StudioAuthSettings,
  link: StoredOAuthCredentialLink,
): StudioAuthSettings {
  return applyStoredOAuthCredentialLink(settings, link);
}

export function applyStoredOAuthCredentialLink(
  settings: StudioAuthSettings | null,
  link: StoredOAuthCredentialLink,
): StudioAuthSettings {
  const nextSettings = settings ?? createDefaultAuthSettings();
  const oauth = nextSettings.oauth ?? createDefaultOAuthSettings();
  const existingProvider = oauth.providers.find((provider) => provider.id === link.providerId);
  const nextProvider = existingProvider
    ? {
        ...existingProvider,
        credentialsRef: link.credentialsRef,
      }
    : {
        id: link.providerId,
        ...link.providerDefaults,
        credentialsRef: link.credentialsRef,
      };

  return {
    ...nextSettings,
    oauth: {
      ...oauth,
      providers: upsertOAuthProvider(oauth.providers, nextProvider),
    },
  };
}

function createStoredOAuthCredentialRollback(
  settings: StudioAuthSettings | null,
  link: StoredOAuthCredentialLink,
): StoredOAuthCredentialRollback {
  const oauth = settings?.oauth ?? createDefaultOAuthSettings();
  const previousProvider =
    oauth.providers.find((provider) => provider.id === link.providerId) ?? null;
  const nextSettings = applyStoredOAuthCredentialLink(settings, link);
  const insertedProvider =
    nextSettings.oauth?.providers.find((provider) => provider.id === link.providerId) ??
    ({
      id: link.providerId,
      ...link.providerDefaults,
      credentialsRef: link.credentialsRef,
    } satisfies AuthOAuthProviderConfig);

  return {
    providerId: link.providerId,
    credentialsRef: link.credentialsRef,
    previousProvider,
    insertedProvider,
  };
}

function rollbackStoredOAuthCredentialLink(
  settings: StudioAuthSettings | null,
  rollback: StoredOAuthCredentialRollback,
): StudioAuthSettings | null {
  if (!settings?.oauth) return settings;

  const currentProvider = settings.oauth.providers.find(
    (provider) => provider.id === rollback.providerId,
  );
  if (currentProvider?.credentialsRef !== rollback.credentialsRef) {
    return settings;
  }

  const { previousProvider } = rollback;
  const providers =
    previousProvider !== null
      ? settings.oauth.providers.map((provider) =>
          provider.id === rollback.providerId
            ? restoreProviderCredentialsRef(provider, previousProvider)
            : provider,
        )
      : removeInsertedOrFailedCredentialsRef(settings.oauth.providers, rollback);

  return {
    ...settings,
    oauth: {
      ...settings.oauth,
      providers,
    },
  };
}

function restoreProviderCredentialsRef(
  currentProvider: AuthOAuthProviderConfig,
  previousProvider: AuthOAuthProviderConfig,
): AuthOAuthProviderConfig {
  const { credentialsRef: _currentCredentialsRef, ...currentWithoutCredentialsRef } =
    currentProvider;
  if (previousProvider.credentialsRef === undefined) {
    return currentWithoutCredentialsRef;
  }

  return {
    ...currentProvider,
    credentialsRef: previousProvider.credentialsRef,
  };
}

function removeInsertedOrFailedCredentialsRef(
  providers: readonly AuthOAuthProviderConfig[],
  rollback: StoredOAuthCredentialRollback,
): AuthOAuthProviderConfig[] {
  return providers.flatMap((provider) => {
    if (provider.id !== rollback.providerId) return [provider];
    if (areOAuthProvidersEqual(provider, rollback.insertedProvider)) return [];

    const { credentialsRef: _credentialsRef, ...providerWithoutCredentialsRef } = provider;
    return [providerWithoutCredentialsRef];
  });
}

function areOAuthProvidersEqual(
  left: AuthOAuthProviderConfig,
  right: AuthOAuthProviderConfig,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createDefaultAuthSettings(): StudioAuthSettings {
  return {
    scope: 'none',
    provider: 'supabase',
    flow: { ...DEFAULT_AUTH_FLOW },
    signIn: { identifiers: ['email'] },
    oauth: createDefaultOAuthSettings(),
  };
}

function createDefaultOAuthSettings(): NonNullable<StudioAuthSettings['oauth']> {
  return {
    enabled: false,
    callbackRoute: '/auth/callback',
    providers: [],
  };
}

function upsertOAuthProvider(
  providers: NonNullable<StudioAuthSettings['oauth']>['providers'],
  provider: AuthOAuthProviderConfig,
): AuthOAuthProviderConfig[] {
  const index = providers.findIndex((candidate) => candidate.id === provider.id);
  if (index < 0) return [...providers, provider];
  return providers.map((candidate, candidateIndex) =>
    candidateIndex === index ? provider : candidate,
  );
}
