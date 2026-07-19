import type { AuthOAuthProviderId } from '@ankhorage/contracts';

import type { StudioAuthSettings } from '../../../authSettings';
import type { StoredOAuthCredentialLink } from './adminAuthCredentialFlow';

export type AuthAdminWriteResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly reason: 'full_auth_save_busy' | 'credential_transaction_busy' | 'provider_busy';
    };

export class AuthAdminWriteCoordinator {
  private fullAuthSaveActive = false;
  private readonly activeProviderIds = new Set<AuthOAuthProviderId>();

  isFullAuthSaveActive(): boolean {
    return this.fullAuthSaveActive;
  }

  isAnyCredentialTransactionActive(): boolean {
    return this.activeProviderIds.size > 0;
  }

  isProviderBusy(providerId: AuthOAuthProviderId): boolean {
    return this.activeProviderIds.has(providerId);
  }

  getBusyProviderIds(): ReadonlySet<AuthOAuthProviderId> {
    return new Set(this.activeProviderIds);
  }

  async runFullAuthSave<T>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> {
    if (this.fullAuthSaveActive) return { ok: false, reason: 'full_auth_save_busy' };
    if (this.activeProviderIds.size > 0) {
      return { ok: false, reason: 'credential_transaction_busy' };
    }

    this.fullAuthSaveActive = true;
    try {
      return { ok: true, value: await operation() };
    } finally {
      this.fullAuthSaveActive = false;
    }
  }

  async runCredentialTransaction<T>(
    providerId: AuthOAuthProviderId,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    if (this.fullAuthSaveActive) return { ok: false, reason: 'full_auth_save_busy' };
    if (this.activeProviderIds.has(providerId)) return { ok: false, reason: 'provider_busy' };

    this.activeProviderIds.add(providerId);
    try {
      return { ok: true, value: await operation() };
    } finally {
      this.activeProviderIds.delete(providerId);
    }
  }
}

export class AuthAdminPendingCredentialRecoveryStore {
  private readonly linksByProviderId = new Map<AuthOAuthProviderId, StoredOAuthCredentialLink>();

  list(): readonly StoredOAuthCredentialLink[] {
    return [...this.linksByProviderId.values()];
  }

  get(providerId: AuthOAuthProviderId): StoredOAuthCredentialLink | null {
    return this.linksByProviderId.get(providerId) ?? null;
  }

  set(link: StoredOAuthCredentialLink): void {
    this.linksByProviderId.set(link.providerId, link);
  }

  clear(providerId: AuthOAuthProviderId): void {
    this.linksByProviderId.delete(providerId);
  }
}

export function rebaseAuthDraftOntoCanonicalCredentialRefs(args: {
  readonly draft: StudioAuthSettings;
  readonly canonical: StudioAuthSettings | null;
}): StudioAuthSettings {
  const canonicalProviders = new Map(
    args.canonical?.oauth?.providers.map((provider) => [provider.id, provider]) ?? [],
  );

  if (!args.draft.oauth) return args.draft;

  return {
    ...args.draft,
    oauth: {
      ...args.draft.oauth,
      providers: args.draft.oauth.providers.map((provider) => {
        const canonicalCredentialsRef = canonicalProviders.get(provider.id)?.credentialsRef;
        const { credentialsRef: _draftCredentialsRef, ...providerWithoutCredentialsRef } = provider;

        return canonicalCredentialsRef
          ? { ...providerWithoutCredentialsRef, credentialsRef: canonicalCredentialsRef }
          : providerWithoutCredentialsRef;
      }),
    },
  };
}
