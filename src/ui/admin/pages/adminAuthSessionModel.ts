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
      readonly reason:
        | 'full_auth_save_busy'
        | 'credential_transaction_busy'
        | 'provider_busy'
        | 'credential_ref_busy'
        | 'credential_secret_cleanup_busy';
    };

export class AuthAdminWriteCoordinator {
  private fullAuthSaveActive = false;
  private readonly activeProviderIds = new Set<AuthOAuthProviderId>();
  private readonly activeCredentialRefs = new Set<string>();
  private readonly activeCredentialSecretCleanupRefs = new Set<string>();

  isFullAuthSaveActive(): boolean {
    return this.fullAuthSaveActive;
  }

  isAnyCredentialTransactionActive(): boolean {
    return this.activeProviderIds.size > 0;
  }

  isProviderBusy(providerId: AuthOAuthProviderId): boolean {
    return this.activeProviderIds.has(providerId);
  }

  isCredentialRefBusy(credentialsRef: string): boolean {
    return (
      this.activeCredentialRefs.has(credentialsRef) ||
      this.activeCredentialSecretCleanupRefs.has(credentialsRef)
    );
  }

  getBusyProviderIds(): ReadonlySet<AuthOAuthProviderId> {
    return new Set(this.activeProviderIds);
  }

  getBusyCredentialRefs(): ReadonlySet<string> {
    return new Set(this.activeCredentialRefs);
  }

  getBusyCredentialSecretCleanupRefs(): ReadonlySet<string> {
    return new Set(this.activeCredentialSecretCleanupRefs);
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
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    if (this.fullAuthSaveActive) return { ok: false, reason: 'full_auth_save_busy' };
    if (this.activeProviderIds.has(providerId)) return { ok: false, reason: 'provider_busy' };
    if (this.activeCredentialRefs.has(credentialsRef)) {
      return { ok: false, reason: 'credential_ref_busy' };
    }
    if (this.activeCredentialSecretCleanupRefs.has(credentialsRef)) {
      return { ok: false, reason: 'credential_secret_cleanup_busy' };
    }

    this.activeProviderIds.add(providerId);
    this.activeCredentialRefs.add(credentialsRef);
    try {
      return { ok: true, value: await operation() };
    } finally {
      this.activeCredentialRefs.delete(credentialsRef);
      this.activeProviderIds.delete(providerId);
    }
  }

  async runCredentialSecretCleanup<T>(
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    if (this.activeCredentialRefs.has(credentialsRef)) {
      return { ok: false, reason: 'credential_transaction_busy' };
    }
    if (this.activeCredentialSecretCleanupRefs.has(credentialsRef)) {
      return { ok: false, reason: 'credential_secret_cleanup_busy' };
    }

    this.activeCredentialSecretCleanupRefs.add(credentialsRef);
    try {
      return { ok: true, value: await operation() };
    } finally {
      this.activeCredentialSecretCleanupRefs.delete(credentialsRef);
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

  clearByCredentialsRef(credentialsRef: string): readonly StoredOAuthCredentialLink[] {
    const cleared: StoredOAuthCredentialLink[] = [];

    for (const link of this.linksByProviderId.values()) {
      if (link.credentialsRef !== credentialsRef) continue;

      this.linksByProviderId.delete(link.providerId);
      cleared.push(link);
    }

    return cleared;
  }
}

export interface AuthAdminProjectSessionSnapshot {
  readonly pendingCredentialLinks: readonly StoredOAuthCredentialLink[];
  readonly busyCredentialProviderIds: ReadonlySet<AuthOAuthProviderId>;
  readonly busyCredentialRefs: ReadonlySet<string>;
  readonly busyCredentialSecretCleanupRefs: ReadonlySet<string>;
  readonly fullAuthSaveBusy: boolean;
}

export class AuthAdminProjectSession {
  private readonly writeCoordinator = new AuthAdminWriteCoordinator();
  private readonly pendingRecovery = new AuthAdminPendingCredentialRecoveryStore();

  constructor(readonly projectId: string) {}

  getSnapshot(): AuthAdminProjectSessionSnapshot {
    return {
      pendingCredentialLinks: this.pendingRecovery.list(),
      busyCredentialProviderIds: this.writeCoordinator.getBusyProviderIds(),
      busyCredentialRefs: this.writeCoordinator.getBusyCredentialRefs(),
      busyCredentialSecretCleanupRefs: this.writeCoordinator.getBusyCredentialSecretCleanupRefs(),
      fullAuthSaveBusy: this.writeCoordinator.isFullAuthSaveActive(),
    };
  }

  setPendingCredentialLink(link: StoredOAuthCredentialLink): void {
    this.pendingRecovery.set(link);
  }

  clearPendingCredentialLink(providerId: AuthOAuthProviderId): void {
    this.pendingRecovery.clear(providerId);
  }

  clearPendingCredentialLinksByCredentialsRef(
    credentialsRef: string,
  ): readonly StoredOAuthCredentialLink[] {
    return this.pendingRecovery.clearByCredentialsRef(credentialsRef);
  }

  async runFullAuthSave<T>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> {
    return await this.writeCoordinator.runFullAuthSave(operation);
  }

  async runCredentialTransaction<T>(
    providerId: AuthOAuthProviderId,
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    return await this.writeCoordinator.runCredentialTransaction(
      providerId,
      credentialsRef,
      operation,
    );
  }

  async runCredentialSecretCleanup<T>(
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    return await this.writeCoordinator.runCredentialSecretCleanup(credentialsRef, operation);
  }
}

export function clearPendingCredentialLinksForRemovedProjectSecret(args: {
  readonly session: {
    readonly clearPendingCredentialLinksByCredentialsRef: (
      credentialsRef: string,
    ) => readonly StoredOAuthCredentialLink[];
  };
  readonly environment: string;
  readonly ref: string;
  readonly removed: boolean;
}): readonly StoredOAuthCredentialLink[] {
  if (!args.removed || args.environment !== 'local') return [];

  return args.session.clearPendingCredentialLinksByCredentialsRef(args.ref);
}

export function rebaseAuthDraftOntoCanonicalCredentialRefs(args: {
  readonly draft: StudioAuthSettings;
  readonly canonical: StudioAuthSettings | null;
}): StudioAuthSettings {
  const canonicalOauth = args.canonical?.oauth;
  const canonicalProvidersById = new Map(
    canonicalOauth?.providers.map((provider) => [provider.id, provider]) ?? [],
  );
  const canonicalCredentialProviders =
    canonicalOauth?.providers.filter((provider) => provider.credentialsRef) ?? [];

  if (!args.draft.oauth) {
    if (canonicalCredentialProviders.length === 0 || !canonicalOauth) return args.draft;

    return {
      ...args.draft,
      oauth: {
        ...canonicalOauth,
        providers: canonicalCredentialProviders,
      },
    };
  }

  const draftProviderIds = new Set(args.draft.oauth.providers.map((provider) => provider.id));
  const rebasedDraftProviders = args.draft.oauth.providers.map((provider) => {
    const canonicalCredentialsRef = canonicalProvidersById.get(provider.id)?.credentialsRef;
    const { credentialsRef: _draftCredentialsRef, ...providerWithoutCredentialsRef } = provider;

    return canonicalCredentialsRef
      ? { ...providerWithoutCredentialsRef, credentialsRef: canonicalCredentialsRef }
      : providerWithoutCredentialsRef;
  });
  const missingCanonicalCredentialProviders = canonicalCredentialProviders.filter(
    (provider) => !draftProviderIds.has(provider.id),
  );

  return {
    ...args.draft,
    oauth: {
      ...args.draft.oauth,
      providers: [...rebasedDraftProviders, ...missingCanonicalCredentialProviders],
    },
  };
}
