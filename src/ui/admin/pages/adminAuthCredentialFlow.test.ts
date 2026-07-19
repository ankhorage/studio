import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from '../../../authSettings';
import type { StoredOAuthCredentialLink } from './adminAuthCredentialFlow';
import { persistStoredOAuthCredentialLink } from './adminAuthCredentialFlow';

function createDraft(credentialsRef = 'auth/oauth/google'): StudioAuthSettings {
  return {
    scope: 'global',
    provider: 'supabase',
    flow: {
      signInRoute: 'sign-in',
      signUpRoute: 'sign-up',
      signOutRoute: 'sign-out',
      forgotPasswordRoute: 'forgot-password',
      postSignInRoute: '/',
      unauthorizedRoute: 'sign-in',
    },
    signIn: { identifiers: ['email'] },
    oauth: {
      enabled: true,
      callbackRoute: '/auth/callback',
      providers: [
        {
          id: 'google',
          enabled: true,
          credentialsRef,
        },
      ],
    },
  };
}

function createLink(credentialsRef = 'auth/oauth/google'): StoredOAuthCredentialLink {
  return {
    providerId: 'google',
    providerLabel: 'Google',
    credentialsRef,
    nextDraft: createDraft(credentialsRef),
    successMessage: `Google credentials saved through ${credentialsRef}.`,
  };
}

describe('admin auth credential flow', () => {
  test('persists the manifest link before refreshing auth health after a secret write', async () => {
    const events: string[] = ['secret'];
    const link = createLink();

    const result = await persistStoredOAuthCredentialLink({
      link,
      updateAuthSettings: () => events.push('manifest-update'),
      flushManifest: () => {
        events.push('manifest-flush');
        return Promise.resolve();
      },
      refreshHealth: () => {
        events.push('health');
        return Promise.resolve();
      },
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(result).toEqual({ ok: true, message: link.successMessage });
    expect(events).toEqual(['secret', 'manifest-update', 'manifest-flush', 'health']);
  });

  test('retains credentialsRef for recoverable retry when manifest persistence fails', async () => {
    const link = createLink('auth/oauth/google-retry');

    const result = await persistStoredOAuthCredentialLink({
      link,
      updateAuthSettings: () => undefined,
      flushManifest: () => Promise.reject(new Error('manifest unavailable')),
      refreshHealth: () => {
        throw new Error('health must not refresh before persistence');
      },
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected recoverable pending link.');
    expect(result.pendingLink.credentialsRef).toBe('auth/oauth/google-retry');
    expect(result.pendingLink.nextDraft.oauth?.providers[0]?.credentialsRef).toBe(
      'auth/oauth/google-retry',
    );
    expect(result.message).toContain('manifest unavailable');
  });

  test('retry persists the intended draft without duplicating the secret write', async () => {
    const events: string[] = ['secret'];
    const link = createLink('auth/oauth/google-existing');

    const failed = await persistStoredOAuthCredentialLink({
      link,
      updateAuthSettings: () => events.push('manifest-update'),
      flushManifest: () => Promise.reject(new Error('first failure')),
      refreshHealth: () => {
        events.push('health');
        return Promise.resolve();
      },
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error('Expected pending link.');

    const retried = await persistStoredOAuthCredentialLink({
      link: failed.pendingLink,
      updateAuthSettings: () => events.push('manifest-update'),
      flushManifest: () => {
        events.push('manifest-flush');
        return Promise.resolve();
      },
      refreshHealth: () => {
        events.push('health');
        return Promise.resolve();
      },
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(retried.ok).toBe(true);
    expect(events).toEqual([
      'secret',
      'manifest-update',
      'manifest-update',
      'manifest-flush',
      'health',
    ]);
  });
});
