import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from '../../../authSettings';
import type { StoredOAuthCredentialLink } from './adminAuthCredentialFlow';
import {
  AuthAdminPendingCredentialRecoveryStore,
  AuthAdminWriteCoordinator,
  rebaseAuthDraftOntoCanonicalCredentialRefs,
} from './adminAuthSessionModel';

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => {
      resolvePromise?.(value);
    },
  };
}

function createAuthSettings(args: {
  readonly googleCredentialsRef?: string;
  readonly githubCredentialsRef?: string;
}): StudioAuthSettings {
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
          scopes: ['email'],
          ...(args.googleCredentialsRef ? { credentialsRef: args.googleCredentialsRef } : {}),
        },
        {
          id: 'github',
          enabled: true,
          scopes: ['user:email'],
          ...(args.githubCredentialsRef ? { credentialsRef: args.githubCredentialsRef } : {}),
        },
      ],
    },
  };
}

function createLink(providerId: AuthOAuthProviderId = 'google'): StoredOAuthCredentialLink {
  return {
    providerId,
    providerLabel: providerId === 'google' ? 'Google' : 'GitHub',
    credentialsRef: `auth/oauth/${providerId}`,
    providerDefaults: {
      label: providerId === 'google' ? 'Google' : 'GitHub',
      scopes: ['email'],
    },
    successMessage: `${providerId} credentials linked.`,
  };
}

describe('AuthAdminWriteCoordinator', () => {
  test('same provider busy state survives consumer remounts through a shared session coordinator', async () => {
    const coordinator = new AuthAdminWriteCoordinator();
    const manifestFlush = createDeferred<void>();

    const consumerA = coordinator;
    const first = consumerA.runCredentialTransaction('google', async () => {
      await manifestFlush.promise;
      return 'linked';
    });

    expect(coordinator.isProviderBusy('google')).toBe(true);

    const consumerB = coordinator;
    const second = await consumerB.runCredentialTransaction('google', () =>
      Promise.resolve('overlap'),
    );

    expect(second).toEqual({ ok: false, reason: 'provider_busy' });
    manifestFlush.resolve();
    expect(await first).toEqual({ ok: true, value: 'linked' });
    expect(coordinator.isProviderBusy('google')).toBe(false);
  });

  test('project isolation uses separate coordinator instances instead of a module-global lock', async () => {
    const projectA = new AuthAdminWriteCoordinator();
    const projectB = new AuthAdminWriteCoordinator();
    const projectAFlush = createDeferred<void>();

    const projectATransaction = projectA.runCredentialTransaction('google', async () => {
      await projectAFlush.promise;
      return 'project-a';
    });
    const projectBTransaction = await projectB.runCredentialTransaction('google', () =>
      Promise.resolve('project-b'),
    );

    expect(projectBTransaction).toEqual({ ok: true, value: 'project-b' });
    expect(projectA.isProviderBusy('google')).toBe(true);
    expect(projectB.isProviderBusy('google')).toBe(false);

    projectAFlush.resolve();
    expect(await projectATransaction).toEqual({ ok: true, value: 'project-a' });
  });

  test('full auth save and credential transactions mutually exclude each other', async () => {
    const coordinator = new AuthAdminWriteCoordinator();
    const providerFlush = createDeferred<void>();
    const fullSaveFlush = createDeferred<void>();

    const providerTransaction = coordinator.runCredentialTransaction('google', async () => {
      await providerFlush.promise;
      return 'provider';
    });
    expect(await coordinator.runFullAuthSave(() => Promise.resolve('full'))).toEqual({
      ok: false,
      reason: 'credential_transaction_busy',
    });
    providerFlush.resolve();
    expect(await providerTransaction).toEqual({ ok: true, value: 'provider' });

    const fullSave = coordinator.runFullAuthSave(async () => {
      await fullSaveFlush.promise;
      return 'full';
    });
    expect(
      await coordinator.runCredentialTransaction('google', () => Promise.resolve('google')),
    ).toEqual({ ok: false, reason: 'full_auth_save_busy' });
    expect(
      await coordinator.runCredentialTransaction('github', () => Promise.resolve('github')),
    ).toEqual({ ok: false, reason: 'full_auth_save_busy' });
    fullSaveFlush.resolve();
    expect(await fullSave).toEqual({ ok: true, value: 'full' });
  });

  test('different providers remain independent when no full auth save is active', async () => {
    const coordinator = new AuthAdminWriteCoordinator();
    const googleFlush = createDeferred<void>();

    const google = coordinator.runCredentialTransaction('google', async () => {
      await googleFlush.promise;
      return 'google';
    });
    const github = await coordinator.runCredentialTransaction('github', () =>
      Promise.resolve('github'),
    );

    expect(github).toEqual({ ok: true, value: 'github' });
    expect(coordinator.isProviderBusy('google')).toBe(true);
    expect(coordinator.isProviderBusy('github')).toBe(false);

    googleFlush.resolve();
    expect(await google).toEqual({ ok: true, value: 'google' });
  });

  test('retry is serialized and does not perform another secret write', async () => {
    const coordinator = new AuthAdminWriteCoordinator();
    const retryFlush = createDeferred<void>();
    let secretWrites = 1;
    let retryLinks = 0;

    const retry = coordinator.runCredentialTransaction('google', async () => {
      retryLinks += 1;
      await retryFlush.promise;
      return 'retry';
    });

    const overlappingRetry = await coordinator.runCredentialTransaction('google', async () => {
      secretWrites += 1;
      retryLinks += 1;
      await Promise.resolve();
      return 'overlap';
    });

    expect(overlappingRetry).toEqual({ ok: false, reason: 'provider_busy' });
    expect(secretWrites).toBe(1);
    expect(retryLinks).toBe(1);

    retryFlush.resolve();
    expect(await retry).toEqual({ ok: true, value: 'retry' });
  });

  test('provider stays busy through secret write, focused mutation, flush, and health refresh', async () => {
    const coordinator = new AuthAdminWriteCoordinator();
    const events: string[] = [];

    const result = await coordinator.runCredentialTransaction('google', async () => {
      events.push('secret-write');
      expect(coordinator.isProviderBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('focused-canonical-mutation');
      expect(coordinator.isProviderBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('manifest-flush');
      expect(coordinator.isProviderBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('health-refresh');
      expect(coordinator.isProviderBusy('google')).toBe(true);
      return 'complete';
    });

    expect(result).toEqual({ ok: true, value: 'complete' });
    expect(events).toEqual([
      'secret-write',
      'focused-canonical-mutation',
      'manifest-flush',
      'health-refresh',
    ]);
    expect(coordinator.isProviderBusy('google')).toBe(false);
  });
});

describe('AuthAdminPendingCredentialRecoveryStore', () => {
  test('pending recovery survives consumer remounts in the same project session', () => {
    const recovery = new AuthAdminPendingCredentialRecoveryStore();
    const consumerA = recovery;

    consumerA.set(createLink('google'));

    const consumerB = recovery;
    expect(consumerB.get('google')).toEqual(createLink('google'));

    consumerB.clear('google');
    expect(consumerA.get('google')).toBeNull();
  });

  test('pending recovery is project-scoped', () => {
    const projectA = new AuthAdminPendingCredentialRecoveryStore();
    const projectB = new AuthAdminPendingCredentialRecoveryStore();

    projectA.set(createLink('google'));

    expect(projectA.list()).toEqual([createLink('google')]);
    expect(projectB.list()).toEqual([]);
  });
});

describe('rebaseAuthDraftOntoCanonicalCredentialRefs', () => {
  test('stale full auth draft cannot erase canonical provider credentials refs', () => {
    const canonical = createAuthSettings({
      googleCredentialsRef: 'auth/oauth/google',
      githubCredentialsRef: 'auth/oauth/github',
    });
    const staleDraft = createAuthSettings({});

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({
      draft: staleDraft,
      canonical,
    });

    expect(rebased.oauth?.providers).toEqual([
      {
        id: 'google',
        enabled: true,
        scopes: ['email'],
        credentialsRef: 'auth/oauth/google',
      },
      {
        id: 'github',
        enabled: true,
        scopes: ['user:email'],
        credentialsRef: 'auth/oauth/github',
      },
    ]);
  });

  test('full auth draft cannot persist pending refs that are not canonical', () => {
    const canonical = createAuthSettings({ googleCredentialsRef: 'auth/oauth/google' });
    const draftWithPendingRef = createAuthSettings({
      googleCredentialsRef: 'auth/oauth/google-pending',
      githubCredentialsRef: 'auth/oauth/github-pending',
    });

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({
      draft: draftWithPendingRef,
      canonical,
    });

    expect(rebased.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
    expect(rebased.oauth?.providers[1]?.credentialsRef).toBeUndefined();
  });
});
