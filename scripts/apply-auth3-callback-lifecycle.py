from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'package.json',
    '"@ankhorage/supabase-auth": "^1.1.1"',
    '"@ankhorage/supabase-auth": "^1.1.2"',
    'studio supabase-auth dependency',
)

replace_once(
    'src/host/orchestrator/templates.ts',
    "const SUPABASE_AUTH_VERSION = '^1.0.0';",
    "const SUPABASE_AUTH_VERSION = '^1.1.2';",
    'generated supabase-auth dependency',
)

replace_once(
    'src/host/orchestrator/templates.test.ts',
    "expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.0.0');",
    "expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.1.2');",
    'generated dependency test',
)

replace_once(
    'src/host/oauthFixtureConsumer.smoke.test.ts',
    "expect(packageJson.dependencies?.['@ankhorage/supabase-auth']).toBe('^1.0.0');",
    "expect(packageJson.dependencies?.['@ankhorage/supabase-auth']).toBe('^1.1.2');",
    'fixture dependency expectation',
)

replace_once(
    'src/host/oauthFixtureConsumer.smoke.test.ts',
    '''    expect(oauthRuntime).toContain(
      "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';",
    );
''',
    '''    expect(oauthRuntime).toContain(
      "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';",
    );
    expect(oauthRuntime).toContain(
      "const LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';",
    );
    expect(oauthRuntime).toContain(
      "interface StoredTransportAttempt {\\n  version: 1;\\n  attemptId: string;\\n}",
    );
    expect(oauthRuntime).not.toContain('provider: AuthOAuthProviderId;');
    expect(oauthRuntime).not.toContain('redirectUri: string;');
''',
    'fixture transport marker expectations',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''  AuthOAuthCompletionResult,
  AuthOAuthProviderId,
  AuthOAuthTransportCancellationReason,
''',
    '''  AuthOAuthCompletionResult,
  AuthOAuthTransportCancellationReason,
''',
    'remove provider-owned transport type',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''const OAUTH_CALLBACK_ROUTE = '${callbackRoute}';
const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';
const GENERATED_OAUTH_PROVIDERS = ${providers} as const;
''',
    '''const OAUTH_CALLBACK_ROUTE = '${callbackRoute}';
const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';
const LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';
const GENERATED_OAUTH_PROVIDERS = ${providers} as const;
''',
    'transport marker keys',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''interface StoredTransportAttempt {
  attemptId: string;
  provider: AuthOAuthProviderId;
  redirectUri: string;
}
''',
    '''interface StoredTransportAttempt {
  version: 1;
  attemptId: string;
}
''',
    'correlation-only transport marker',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''    await writeTransportAttempt({
      attemptId: started.data.attemptId,
      provider: started.data.provider,
      redirectUri: started.data.redirectUri,
    });
''',
    '''    await writeTransportAttempt({
      version: 1,
      attemptId: started.data.attemptId,
    });
''',
    'write minimal transport marker',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''  const attempt = await readTransportAttempt();
  if (!attempt) {
    return {
      status: 'error',
      message: 'The OAuth authorization attempt was not found or has expired.',
      recoverable: true,
    };
  }

  const completed = await oauth.completeAuthorization({
    attemptId: attempt.attemptId,
    response: { type: 'callback', url: callbackUrl },
  });
  await clearTransportAttempt();

  if (
    !completed.ok &&
    completed.status === 'error' &&
    completed.error.code === 'callback_already_completed' &&
    getStoredAuthSession()
  ) {
    return { status: 'authenticated' };
  }

  return toTransportOutcome(completed);
''',
    '''  const attempt = await readTransportAttempt();
  if (!attempt) {
    if (getStoredAuthSession() && isCanonicalOAuthCallback(callbackUrl)) {
      return { status: 'authenticated' };
    }
    return {
      status: 'error',
      message: 'The OAuth authorization attempt was not found or has expired.',
      recoverable: true,
    };
  }

  let completed: AuthOAuthCompletionResult;
  try {
    completed = await oauth.completeAuthorization({
      attemptId: attempt.attemptId,
      response: { type: 'callback', url: callbackUrl },
    });
  } catch {
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The OAuth callback could not be completed.',
      recoverable: true,
    };
  }
  await clearTransportAttempt();

  if (
    !completed.ok &&
    completed.status === 'error' &&
    completed.error.code === 'callback_already_completed' &&
    getStoredAuthSession()
  ) {
    return { status: 'authenticated' };
  }

  return toTransportOutcome(completed);
''',
    'callback completion coordination',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''  return Linking.createURL(callbackPath);
}

function getBrowserLocation(): object | null {
''',
    '''  return Linking.createURL(callbackPath);
}

function isCanonicalOAuthCallback(callbackUrl: string): boolean {
  try {
    const delivered = new URL(callbackUrl);
    const expected = new URL(resolveOAuthRedirectUri());
    return (
      delivered.protocol === expected.protocol &&
      delivered.username === expected.username &&
      delivered.password === expected.password &&
      delivered.host === expected.host &&
      delivered.pathname === expected.pathname &&
      delivered.hash.length === 0
    );
  } catch {
    return false;
  }
}

function getBrowserLocation(): object | null {
''',
    'canonical callback fallback',
)

replace_once(
    'src/host/layout/templates/auth/oauth.ts',
    '''async function writeTransportAttempt(attempt: StoredTransportAttempt): Promise<void> {
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const attemptId = Reflect.get(value, 'attemptId');
    const provider = Reflect.get(value, 'provider');
    const redirectUri = Reflect.get(value, 'redirectUri');
    const configuredProvider =
      typeof provider === 'string'
        ? GENERATED_OAUTH_PROVIDERS.find((entry) => entry.id === provider)
        : undefined;
    return typeof attemptId === 'string' &&
      configuredProvider !== undefined &&
      typeof redirectUri === 'string'
      ? { attemptId, provider: configuredProvider.id, redirectUri }
      : null;
  } catch {
    return null;
  }
}

async function clearTransportAttempt(): Promise<void> {
  try {
    await authSessionStorage.removeItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  } catch {
    // Cleanup failures are intentionally not surfaced with persisted state.
  }
}
''',
    '''async function writeTransportAttempt(attempt: StoredTransportAttempt): Promise<void> {
  await clearLegacyTransportAttempt();
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) {
    await clearLegacyTransportAttempt();
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value)) {
      const version = Reflect.get(value, 'version');
      const attemptId = Reflect.get(value, 'attemptId');
      if (version === 1 && typeof attemptId === 'string' && attemptId.trim().length > 0) {
        return { version, attemptId };
      }
    }
  } catch {
    // Invalid transport state is cleaned below without exposing its contents.
  }
  await clearTransportAttempt();
  return null;
}

async function clearTransportAttempt(): Promise<void> {
  await Promise.all([
    safeRemoveTransportItem(OAUTH_TRANSPORT_ATTEMPT_KEY),
    safeRemoveTransportItem(LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY),
  ]);
}

async function clearLegacyTransportAttempt(): Promise<void> {
  await safeRemoveTransportItem(LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY);
}

async function safeRemoveTransportItem(key: string): Promise<void> {
  try {
    await authSessionStorage.removeItem(key);
  } catch {
    // Cleanup failures are intentionally not surfaced with persisted state.
  }
}
''',
    'transport storage protocol',
)

with Path('src/host/layout/templates/auth/oauth.test.ts').open('a') as file:
    file.write(
        '''\n\ntest('generates adapter-owned OAuth lifecycle coordination with a correlation-only marker', () => {\n  const runtime = createOAuthRuntime();\n\n  expect(runtime).toContain(\n    "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';",\n  );\n  expect(runtime).toContain(\n    "const LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';",\n  );\n  expect(runtime).toContain('interface StoredTransportAttempt {\\n  version: 1;\\n  attemptId: string;\\n}');\n  expect(runtime).not.toContain('provider: AuthOAuthProviderId;');\n  expect(runtime).not.toContain('redirectUri: string;');\n  expect(runtime).toContain('getStoredAuthSession() && isCanonicalOAuthCallback(callbackUrl)');\n  expect(runtime).toContain('await clearLegacyTransportAttempt();');\n  expect(runtime).toContain('await clearTransportAttempt();');\n});\n'''
    )

replace_once(
    'src/host/layout/templates/auth/callback.ts',
    '''function completeOAuthCallbackOnce(callbackUrl: string) {
  if (!activeCallbackCompletion || activeCallbackCompletion.callbackUrl !== callbackUrl) {
    activeCallbackCompletion = {
      callbackUrl,
      promise: completeOAuthCallback(callbackUrl),
    };
  }
  return activeCallbackCompletion.promise;
}
''',
    '''function completeOAuthCallbackOnce(callbackUrl: string) {
  if (!activeCallbackCompletion || activeCallbackCompletion.callbackUrl !== callbackUrl) {
    const completion: ActiveCallbackCompletion = {
      callbackUrl,
      promise: completeOAuthCallback(callbackUrl),
    };
    activeCallbackCompletion = completion;
    void completion.promise
      .finally(() => {
        if (activeCallbackCompletion === completion) {
          activeCallbackCompletion = null;
        }
      })
      .catch(() => {
        // The original promise remains the callback screen's error boundary.
      });
  }
  return activeCallbackCompletion.promise;
}
''',
    'bounded callback promise retention',
)

replace_once(
    'src/host/layout/templates/auth/callback.test.ts',
    "  expect(callback).toContain('promise: completeOAuthCallback(callbackUrl)');\n",
    "  expect(callback).toContain('promise: completeOAuthCallback(callbackUrl)');\n  expect(callback).toContain('if (activeCallbackCompletion === completion) {');\n  expect(callback).toContain('activeCallbackCompletion = null;');\n",
    'callback completion cleanup expectations',
)

Path('.changeset/gentle-oauth-callback-lifecycle.md').write_text(
    '''---\n"@ankhorage/studio": patch\n---\n\nConsume the released self-healing Supabase OAuth lifecycle, reduce generated transport persistence to a correlation-only marker, and prove full-page callback completion, replay protection, session persistence, and provider-denial recovery across navigation boundaries.\n'''
)
