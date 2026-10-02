import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import {
  createExclusiveKeyedAsyncCoordinator,
  type ExclusiveKeyedAsyncResult,
} from '@ankhorage/utility/concurrency';
import { createKeyedValueStore } from '@ankhorage/utility/registry';

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

/*** Map generic coordinator conflicts to Studio auth-admin write reasons. */
function toAuthAdminWriteResult<T>(result: ExclusiveKeyedAsyncResult<T>): AuthAdminWriteResult<T> {
  if (result.ok) return result;
  const reason = {
    exclusive_busy: 'full_auth_save_busy',
    keyed_busy: 'credential_transaction_busy',
    primary_busy: 'provider_busy',
    secondary_busy: 'credential_ref_busy',
    secondary_exclusive_busy: 'credential_secret_cleanup_busy',
  } as const;
  return { ok: false, reason: reason[result.reason] };
}

/*** Coordinate Studio auth writes with project-specific conflict reasons. */
export class AuthAdminWriteCoordinator {
  private readonly coordinator = createExclusiveKeyedAsyncCoordinator<
    AuthOAuthProviderId,
    string
  >();

  isFullAuthSaveActive(): boolean {
    return this.coordinator.isExclusiveActive();
  }

  isAnyCredentialTransactionActive(): boolean {
    return this.coordinator.hasActiveKeyed();
  }

  isProviderBusy(providerId: AuthOAuthProviderId): boolean {
    return this.coordinator.isPrimaryBusy(providerId);
  }

  isCredentialRefBusy(credentialsRef: string): boolean {
    return this.coordinator.isSecondaryBusy(credentialsRef);
  }

  getBusyProviderIds(): ReadonlySet<AuthOAuthProviderId> {
    return this.coordinator.getBusyPrimaryKeys();
  }

  getBusyCredentialRefs(): ReadonlySet<string> {
    return this.coordinator.getBusySecondaryKeys();
  }

  getBusyCredentialSecretCleanupRefs(): ReadonlySet<string> {
    return this.coordinator.getBusySecondaryExclusiveKeys();
  }

  async runFullAuthSave<T>(operation: () => Promise<T>): Promise<AuthAdminWriteResult<T>> {
    return toAuthAdminWriteResult(await this.coordinator.runExclusive(operation));
  }

  async runCredentialTransaction<T>(
    providerId: AuthOAuthProviderId,
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    return toAuthAdminWriteResult(
      await this.coordinator.runKeyed(providerId, credentialsRef, operation),
    );
  }

  async runCredentialSecretCleanup<T>(
    credentialsRef: string,
    operation: () => Promise<T>,
  ): Promise<AuthAdminWriteResult<T>> {
    return toAuthAdminWriteResult(
      await this.coordinator.runSecondaryExclusive(credentialsRef, operation),
    );
  }
}

/*** Store pending Studio OAuth credential links by provider identity. */
export class AuthAdminPendingCredentialRecoveryStore {
  private readonly links = createKeyedValueStore<AuthOAuthProviderId, StoredOAuthCredentialLink>(
    (link) => link.providerId,
  );

  list(): readonly StoredOAuthCredentialLink[] {
    return this.links.list();
  }

  get(providerId: AuthOAuthProviderId): StoredOAuthCredentialLink | null {
    return this.links.get(providerId);
  }

  set(link: StoredOAuthCredentialLink): void {
    this.links.set(link);
  }

  clear(providerId: AuthOAuthProviderId): void {
    this.links.delete(providerId);
  }

  clearByCredentialsRef(credentialsRef: string): readonly StoredOAuthCredentialLink[] {
    return this.links.deleteWhere((link) => link.credentialsRef === credentialsRef);
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
