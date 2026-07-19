import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings, StudioAuthSettingsMutation } from '../../../authSettings';
import type { StoredOAuthCredentialLink } from './adminAuthCredentialFlow';
import {
  applyStoredOAuthCredentialLink,
  persistStoredOAuthCredentialLink,
} from './adminAuthCredentialFlow';

function createAuthSettings(
  args: {
    readonly credentialsRef?: string;
    readonly oauthEnabled?: boolean;
    readonly callbackRoute?: string;
  } = {},
): StudioAuthSettings {
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
      enabled: args.oauthEnabled ?? false,
      callbackRoute: args.callbackRoute ?? '/auth/callback',
      providers: [
        {
          id: 'google',
          enabled: false,
          scopes: ['email'],
          queryParams: { prompt: 'select_account' },
          ...(args.credentialsRef ? { credentialsRef: args.credentialsRef } : {}),
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
    providerDefaults: {
      label: 'Google',
      scopes: ['openid', 'email', 'profile'],
    },
    successMessage: `Google credentials saved through ${credentialsRef}.`,
  };
}

function createStore(initial: StudioAuthSettings | null) {
  let auth = initial;
  const writes: (StudioAuthSettings | null)[] = [];
  return {
    readAuthSettings: () => auth,
    mutateAuthSettings: (mutation: StudioAuthSettingsMutation) => {
      auth = mutation(auth);
      writes.push(auth);
      return auth;
    },
    readPersistedAuthSettings: () => auth,
    writes,
  };
}

describe('admin auth credential flow', () => {
  test('applies the provider link and refreshes health only after manifest flush succeeds', async () => {
    const events: string[] = ['secret'];
    const store = createStore(createAuthSettings());
    const link = createLink();

    const result = await persistStoredOAuthCredentialLink({
      link,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: (mutation) => {
        events.push('manifest-update');
        return store.mutateAuthSettings(mutation);
      },
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
    expect(store.readAuthSettings()?.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
    expect(events).toEqual(['secret', 'manifest-update', 'manifest-flush', 'health']);
  });

  test('rolls back canonical auth state and retains focused pending recovery on flush failure', async () => {
    const previous = createAuthSettings();
    const store = createStore(previous);
    const link = createLink('auth/oauth/google-retry');

    const result = await persistStoredOAuthCredentialLink({
      link,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: store.mutateAuthSettings,
      flushManifest: () => Promise.reject(new Error('manifest unavailable')),
      refreshHealth: () => {
        throw new Error('health must not refresh before persistence');
      },
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected recoverable pending link.');
    expect(store.readAuthSettings()).toEqual(previous);
    expect(result.pendingLink).toEqual(link);
    expect(JSON.stringify(result.pendingLink)).not.toContain('signInRoute');
    expect(result.message).toContain('manifest unavailable');
  });

  test('normal background autosave after failure reads restored auth state without the failed link', async () => {
    const store = createStore(createAuthSettings());
    const link = createLink('auth/oauth/google-failed');

    await persistStoredOAuthCredentialLink({
      link,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: store.mutateAuthSettings,
      flushManifest: () => Promise.reject(new Error('manifest unavailable')),
      refreshHealth: () => Promise.resolve(),
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(JSON.stringify(store.readPersistedAuthSettings())).not.toContain(
      'auth/oauth/google-failed',
    );
  });

  test('retry applies the focused link to the latest canonical auth state', async () => {
    const store = createStore(createAuthSettings());
    const link = createLink('auth/oauth/google-retry');

    const failed = await persistStoredOAuthCredentialLink({
      link,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: store.mutateAuthSettings,
      flushManifest: () => Promise.reject(new Error('first failure')),
      refreshHealth: () => Promise.resolve(),
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error('Expected pending link.');

    store.mutateAuthSettings((current) => ({
      ...(current ?? createAuthSettings()),
      oauth: {
        ...((current ?? createAuthSettings()).oauth ?? {
          enabled: false,
          callbackRoute: '/auth/callback',
          providers: [],
        }),
        enabled: true,
        callbackRoute: '/auth/custom-callback',
      },
    }));

    const retried = await persistStoredOAuthCredentialLink({
      link: failed.pendingLink,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: store.mutateAuthSettings,
      flushManifest: () => Promise.resolve(),
      refreshHealth: () => Promise.resolve(),
      toMessage: (error) => (error instanceof Error ? error.message : 'failed'),
    });

    expect(retried.ok).toBe(true);
    expect(store.readAuthSettings()?.oauth?.enabled).toBe(true);
    expect(store.readAuthSettings()?.oauth?.callbackRoute).toBe('/auth/custom-callback');
    expect(store.readAuthSettings()?.oauth?.providers[0]).toMatchObject({
      id: 'google',
      enabled: false,
      queryParams: { prompt: 'select_account' },
      credentialsRef: 'auth/oauth/google-retry',
    });
  });

  test('retry does not perform another secret write and refreshes health only after persistence', async () => {
    const events: string[] = ['secret'];
    const store = createStore(createAuthSettings());
    const link = createLink('auth/oauth/google-existing');

    const failed = await persistStoredOAuthCredentialLink({
      link,
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: store.mutateAuthSettings,
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
      readAuthSettings: store.readAuthSettings,
      mutateAuthSettings: () => {
        events.push('manifest-update');
        return store.mutateAuthSettings((current) =>
          applyStoredOAuthCredentialLink(current, failed.pendingLink),
        );
      },
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
    expect(events).toEqual(['secret', 'manifest-update', 'manifest-flush', 'health']);
  });

  test('credential linking preserves unrelated canonical OAuth state instead of saving local draft edits', () => {
    const canonical = createAuthSettings({ oauthEnabled: false });
    const localDraft = createAuthSettings({ oauthEnabled: true });
    const linked = applyStoredOAuthCredentialLink(canonical, createLink('auth/oauth/google'));

    expect(localDraft.oauth?.enabled).toBe(true);
    expect(linked.oauth?.enabled).toBe(false);
    expect(linked.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
  });
});
