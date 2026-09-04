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

  /***
   * Return whether the coordinator currently holds its exclusive whole-resource write lock.
   * @utility @ankhorage/utility/concurrency
   */
  isFullAuthSaveActive(): boolean {
    return this.fullAuthSaveActive;
  }

  /***
   * Return whether any keyed transaction is currently active.
   * @utility @ankhorage/utility/concurrency
   */
  isAnyCredentialTransactionActive(): boolean {
    return this.activeProviderIds.size > 0;
  }

  /***
   * Return whether one primary key currently owns an active keyed transaction.
   * @utility @ankhorage/utility/concurrency
   */
  isProviderBusy(providerId: AuthOAuthProviderId): boolean {
    return this.activeProviderIds.has(providerId);
  }

  /***
   * Return whether one secondary key is reserved either by a transaction or a cleanup operation.
   * @utility @ankhorage/utility/concurrency
   */
  isCredentialRefBusy(credentialsRef: string): boolean {
    return (
      this.activeCredentialRefs.has(credentialsRef) ||
      this.activeCredentialSecretCleanupRefs.has(credentialsRef)
    );
  }

  /***
   * Return an immutable snapshot copy of currently busy primary keys.
   * @utility @ankhorage/utility/collection
   */
  getBusyProviderIds(): ReadonlySet<AuthOAuthProviderId> {
    return new Set(this.activeProviderIds);
  }

  /***
   * Return an immutable snapshot copy of currently busy secondary transaction keys.
   * @utility @ankhorage/utility/collection
   */
  getBusyCredentialRefs(): ReadonlySet<string> {
    return new Set(this.activeCredentialRefs);
  }

  /***
   * Return an immutable snapshot copy of secondary keys currently reserved for cleanup.
   * @utility @ankhorage/utility/collection
   */
  getBusyCredentialSecretCleanupRefs(): ReadonlySet<string> {
    return new Set(this.activeCredentialSecretCleanupRefs);
  }

  /***
   * Execute an exclusive whole-resource asynchronous operation unless any conflicting whole/keyed operation is active.
   * @utility @ankhorage/utility/concurrency
   */
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

  /***
   * Execute an asynchronous operation while atomically reserving a primary and secondary key and rejecting conflicting reservations.
   * @utility @ankhorage/utility/concurrency
   */
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

  /***
   * Execute an asynchronous cleanup while reserving one secondary key against concurrent transaction/cleanup use.
   * @utility @ankhorage/utility/concurrency
   */
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

  /***
   * Return all values currently held by a keyed in-memory registry.
   * @utility @ankhorage/utility/registry
   */
  list(): readonly StoredOAuthCredentialLink[] {
    return [...this.linksByProviderId.values()];
  }

  /***
   * Resolve one registry value by primary key, normalizing a miss to null.
   * @utility @ankhorage/utility/registry
   */
  get(providerId: AuthOAuthProviderId): StoredOAuthCredentialLink | null {
    return this.linksByProviderId.get(providerId) ?? null;
  }

  /***
   * Insert or replace one registry value using a key derived from the value.
   * @utility @ankhorage/utility/registry
   */
  set(link: StoredOAuthCredentialLink): void {
    this.linksByProviderId.set(link.providerId, link);
  }

  /***
   * Delete one registry value by primary key.
   * @utility @ankhorage/utility/registry
   */
  clear(providerId: AuthOAuthProviderId): void {
    this.linksByProviderId.delete(providerId);
  }

  /***
   * Delete and return every registry value matching a secondary-key predicate.
   * @utility @ankhorage/utility/registry
   */
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

  /*** Create the auth-admin application session for one Studio project. */
  constructor(readonly projectId: string) {}

  /*** Project auth-admin transaction and pending-recovery state into an immutable UI snapshot. */
  getSnapshot(): AuthAdminProjectSessionSnapshot {
    return {
      pendingCredentialLinks: this.pendingRecovery.list(),
      busyCredentialProviderIds: this.writeCoordinator.getBusyProviderIds(),
      busyCredentialRefs: this.writeCoordinator.getBusyCredentialRefs(),
      busyCredentialSecretCleanupRefs: this.writeCoordinator.getBusyCredentialSecretCleanupRefs(),
      fullAuthSaveBusy: this.writeCoordinator.isFullAuthSaveActive(),
    };
  }

  /*** Store one pending OAuth credential link that needs later recovery/persistence. */
  setPendingCredentialLink(link: StoredOAuthCredentialLink): void {
    this.pendingRecovery.set(link);
  }

  /*** Clear the pending OAuth credential link for one provider. */
  clearPendingCredentialLink(providerId: AuthOAuthProviderId): void {
    this.pendingRecovery.clear(providerId);
  }

  /*** Clear and return all pending links backed by one credential reference. */
  clearPendingCredentialLinksByCredentialsRef(
    credentialsRef: string,
  ): readonly StoredOAuthCredentialLink[] {
    return this.pendingRecovery.clearByCredentialsRef(credentialsRef);
  }

  /*** Delegate a whole-auth save to the session's write coordinator. */
  async runFullAuthSave<T>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> {
    return await this.writeCoordinator.runFullAuthSave(operation);
  }

  /*** Delegate a provider/credential transaction to the session's write coordinator. */
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

  /*** Delegate credential-secret cleanup to the session's write coordinator. */
  async runCredentialSecretCleanup<T>(
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    return await this.writeCoordinator.runCredentialSecretCleanup(credentialsRef, operation);
  }
}

/*** Clear pending local credential links after their backing local project secret was actually removed. */
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

/***
 * Rebase an editable auth draft onto canonical OAuth credential references while preserving all other draft edits.
 * @todo Move this auth reconciliation policy from `ui/` into the auth application/domain layer.
 */
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
