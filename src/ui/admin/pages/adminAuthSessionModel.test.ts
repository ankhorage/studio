import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from '../../../authSettings';
import type { StoredOAuthCredentialLink } from './adminAuthCredentialFlow';
import {
  AuthAdminPendingCredentialRecoveryStore,
  AuthAdminProjectSession,
  AuthAdminWriteCoordinator,
  clearPendingCredentialLinksForRemovedProjectSecret,
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

function getOAuth(settings: StudioAuthSettings): NonNullable<StudioAuthSettings['oauth']> {
  if (!settings.oauth) throw new Error('Expected OAuth settings.');
  return settings.oauth;
}

function withOAuthProviders(
  settings: StudioAuthSettings,
  providers: NonNullable<StudioAuthSettings['oauth']>['providers'],
): StudioAuthSettings {
  return {
    ...settings,
    oauth: {
      ...getOAuth(settings),
      providers,
    },
  };
}

function withoutOAuth(settings: StudioAuthSettings): StudioAuthSettings {
  const { oauth: _oauth, ...settingsWithoutOAuth } = settings;
  return settingsWithoutOAuth;
}

function getProvider(
  settings: StudioAuthSettings,
  providerId: AuthOAuthProviderId,
): NonNullable<StudioAuthSettings['oauth']>['providers'][number] | null {
  return settings.oauth?.providers.find((provider) => provider.id === providerId) ?? null;
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

function createProjectSessionConsumer(session: AuthAdminProjectSession): {
  readonly snapshot: () => ReturnType<AuthAdminProjectSession['getSnapshot']>;
  readonly setPendingCredentialLink: (link: StoredOAuthCredentialLink) => void;
  readonly clearPendingCredentialLinksByCredentialsRef: (
    credentialsRef: string,
  ) => readonly StoredOAuthCredentialLink[];
  readonly runCredentialTransaction: AuthAdminProjectSession['runCredentialTransaction'];
} {
  return {
    snapshot: () => session.getSnapshot(),
    setPendingCredentialLink: (link) => session.setPendingCredentialLink(link),
    clearPendingCredentialLinksByCredentialsRef: (credentialsRef) =>
      session.clearPendingCredentialLinksByCredentialsRef(credentialsRef),
    runCredentialTransaction: (providerId, operation) =>
      session.runCredentialTransaction(providerId, operation),
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

describe('AuthAdminProjectSession', () => {
  test('transaction remains busy when admin consumers disappear and reappear', async () => {
    const session = new AuthAdminProjectSession('project-a');
    const manifestFlush = createDeferred<void>();
    const consumerA = createProjectSessionConsumer(session);

    const first = consumerA.runCredentialTransaction('google', async () => {
      await manifestFlush.promise;
      return 'linked';
    });

    expect(consumerA.snapshot().busyCredentialProviderIds.has('google')).toBe(true);

    const consumerB = createProjectSessionConsumer(session);
    expect(consumerB.snapshot().busyCredentialProviderIds.has('google')).toBe(true);
    expect(
      await consumerB.runCredentialTransaction('google', () => Promise.resolve('overlap')),
    ).toEqual({ ok: false, reason: 'provider_busy' });

    manifestFlush.resolve();
    expect(await first).toEqual({ ok: true, value: 'linked' });
    expect(consumerB.snapshot().busyCredentialProviderIds.has('google')).toBe(false);
  });

  test('pending recovery remains available after leaving admin and returning', () => {
    const session = new AuthAdminProjectSession('project-a');
    const consumerA = createProjectSessionConsumer(session);

    consumerA.setPendingCredentialLink(createLink('google'));

    const consumerB = createProjectSessionConsumer(session);
    expect(consumerB.snapshot().pendingCredentialLinks).toEqual([createLink('google')]);
  });

  test('project change creates isolated fresh session state', async () => {
    const projectA = new AuthAdminProjectSession('project-a');
    const projectB = new AuthAdminProjectSession('project-b');
    const projectAFlush = createDeferred<void>();

    projectA.setPendingCredentialLink(createLink('google'));
    const projectATransaction = projectA.runCredentialTransaction('google', async () => {
      await projectAFlush.promise;
      return 'project-a';
    });

    expect(projectB.getSnapshot().pendingCredentialLinks).toEqual([]);
    expect(projectB.getSnapshot().busyCredentialProviderIds.has('google')).toBe(false);
    expect(
      await projectB.runCredentialTransaction('google', () => Promise.resolve('project-b')),
    ).toEqual({
      ok: true,
      value: 'project-b',
    });

    projectAFlush.resolve();
    expect(await projectATransaction).toEqual({ ok: true, value: 'project-a' });
  });
});

describe('clearPendingCredentialLinksForRemovedProjectSecret', () => {
  test('successful matching local secret removal clears pending link', () => {
    const session = new AuthAdminProjectSession('project-a');
    session.setPendingCredentialLink(createLink('google'));

    const cleared = clearPendingCredentialLinksForRemovedProjectSecret({
      session,
      environment: 'local',
      ref: 'auth/oauth/google',
      removed: true,
    });

    expect(cleared).toEqual([createLink('google')]);
    expect(session.getSnapshot().pendingCredentialLinks).toEqual([]);
  });

  test('unrelated secret removal keeps pending link', () => {
    const session = new AuthAdminProjectSession('project-a');
    session.setPendingCredentialLink(createLink('google'));

    expect(
      clearPendingCredentialLinksForRemovedProjectSecret({
        session,
        environment: 'local',
        ref: 'auth/oauth/github',
        removed: true,
      }),
    ).toEqual([]);
    expect(session.getSnapshot().pendingCredentialLinks).toEqual([createLink('google')]);
  });

  test('failed deletion keeps pending link', () => {
    const session = new AuthAdminProjectSession('project-a');
    session.setPendingCredentialLink(createLink('google'));

    expect(
      clearPendingCredentialLinksForRemovedProjectSecret({
        session,
        environment: 'local',
        ref: 'auth/oauth/google',
        removed: false,
      }),
    ).toEqual([]);
    expect(session.getSnapshot().pendingCredentialLinks).toEqual([createLink('google')]);
  });

  test('multiple pending links are selectively cleared', () => {
    const session = new AuthAdminProjectSession('project-a');
    session.setPendingCredentialLink(createLink('google'));
    session.setPendingCredentialLink(createLink('github'));

    expect(
      clearPendingCredentialLinksForRemovedProjectSecret({
        session,
        environment: 'local',
        ref: 'auth/oauth/google',
        removed: true,
      }),
    ).toEqual([createLink('google')]);
    expect(session.getSnapshot().pendingCredentialLinks).toEqual([createLink('github')]);
  });

  test('non-local removal keeps pending recovery for local credential links', () => {
    const session = new AuthAdminProjectSession('project-a');
    session.setPendingCredentialLink(createLink('google'));

    expect(
      clearPendingCredentialLinksForRemovedProjectSecret({
        session,
        environment: 'production',
        ref: 'auth/oauth/google',
        removed: true,
      }),
    ).toEqual([]);
    expect(session.getSnapshot().pendingCredentialLinks).toEqual([createLink('google')]);
  });
});

describe('rebaseAuthDraftOntoCanonicalCredentialRefs', () => {
  test('canonical credential provider missing from draft is preserved', () => {
    const canonical = withOAuthProviders(
      createAuthSettings({ googleCredentialsRef: 'auth/oauth/google' }),
      [
        {
          id: 'google',
          enabled: true,
          scopes: ['email'],
          credentialsRef: 'auth/oauth/google',
        },
      ],
    );
    const draft = withOAuthProviders(createAuthSettings({}), []);

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(rebased.oauth?.providers).toEqual([
      {
        id: 'google',
        enabled: true,
        scopes: ['email'],
        credentialsRef: 'auth/oauth/google',
      },
    ]);
  });

  test('multiple canonical credential providers missing from draft are preserved', () => {
    const canonical = createAuthSettings({
      googleCredentialsRef: 'auth/oauth/google',
      githubCredentialsRef: 'auth/oauth/github',
    });
    const draft = withOAuthProviders(createAuthSettings({}), []);

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(getProvider(rebased, 'google')?.credentialsRef).toBe('auth/oauth/google');
    expect(getProvider(rebased, 'github')?.credentialsRef).toBe('auth/oauth/github');
  });

  test('absent draft OAuth cannot erase canonical credential links', () => {
    const canonical = withOAuthProviders(
      createAuthSettings({ googleCredentialsRef: 'auth/oauth/google' }),
      [
        {
          id: 'google',
          enabled: true,
          scopes: ['email'],
          credentialsRef: 'auth/oauth/google',
        },
      ],
    );
    const draft = withoutOAuth(createAuthSettings({}));

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(rebased.oauth).toEqual(getOAuth(canonical));
  });

  test('stale draft credentialsRef cannot replace canonical credentialsRef', () => {
    const canonical = createAuthSettings({ googleCredentialsRef: 'auth/oauth/google-canonical' });
    const draft = createAuthSettings({ googleCredentialsRef: 'auth/oauth/google-stale' });

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(getProvider(rebased, 'google')?.credentialsRef).toBe('auth/oauth/google-canonical');
  });

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

  test('canonical provider without credentialsRef follows normal editable removal semantics', () => {
    const canonical = createAuthSettings({});
    const draft = withOAuthProviders(createAuthSettings({}), []);

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(rebased.oauth?.providers).toEqual([]);
  });

  test('editable OAuth fields follow draft while credential providers survive', () => {
    const canonical = createAuthSettings({ googleCredentialsRef: 'auth/oauth/google' });
    const draft = {
      ...createAuthSettings({}),
      oauth: {
        enabled: false,
        callbackRoute: '/draft/callback',
        providers: [],
      },
    };

    const rebased = rebaseAuthDraftOntoCanonicalCredentialRefs({ draft, canonical });

    expect(rebased.oauth?.enabled).toBe(false);
    expect(rebased.oauth?.callbackRoute).toBe('/draft/callback');
    expect(getProvider(rebased, 'google')?.credentialsRef).toBe('auth/oauth/google');
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
