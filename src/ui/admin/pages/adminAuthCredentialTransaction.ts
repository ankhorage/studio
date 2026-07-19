import type { AuthOAuthProviderId } from '@ankhorage/contracts';

export type OAuthCredentialTransactionResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly reason: 'provider_busy';
    };

export class OAuthCredentialTransactionCoordinator {
  private readonly activeProviderIds = new Set<AuthOAuthProviderId>();

  isBusy(providerId: AuthOAuthProviderId): boolean {
    return this.activeProviderIds.has(providerId);
  }

  async run<T>(
    providerId: AuthOAuthProviderId,
    operation: () => Promise<T>,
  ): Promise<OAuthCredentialTransactionResult<T>> {
    if (this.activeProviderIds.has(providerId)) {
      return { ok: false, reason: 'provider_busy' };
    }

    this.activeProviderIds.add(providerId);
    try {
      return { ok: true, value: await operation() };
    } finally {
      this.activeProviderIds.delete(providerId);
    }
  }
}
