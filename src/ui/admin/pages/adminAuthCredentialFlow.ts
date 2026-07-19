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

export async function persistStoredOAuthCredentialLink(args: {
  readonly link: StoredOAuthCredentialLink;
  readonly readAuthSettings: () => StudioAuthSettings | null;
  readonly mutateAuthSettings: (mutation: StudioAuthSettingsMutation) => StudioAuthSettings | null;
  readonly flushManifest: () => Promise<void>;
  readonly refreshHealth: () => Promise<void>;
  readonly toMessage: (error: unknown) => string;
}): Promise<StoredOAuthCredentialLinkResult> {
  const previousAuthSettings = args.readAuthSettings();
  args.mutateAuthSettings((current) => applyStoredOAuthCredentialLink(current, args.link));

  try {
    await args.flushManifest();
  } catch (error) {
    args.mutateAuthSettings(() => previousAuthSettings);
    return {
      ok: false,
      pendingLink: args.link,
      message: `${args.link.providerLabel} credentials were saved, but the Studio manifest link could not be persisted: ${args.toMessage(error)}`,
    };
  }

  await args.refreshHealth();
  return { ok: true, message: args.link.successMessage };
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
