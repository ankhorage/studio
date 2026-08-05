import { describe, expect, test } from 'bun:test';

import {
  parseProjectAuthRuntimeStatus,
  resolveProjectAuthRedirectRuntime,
} from './projectAuthRuntimeDiagnostics';

describe('resolveProjectAuthRedirectRuntime', () => {
  test('derives local provider and app callbacks from persisted project ports', () => {
    const runtime = resolveProjectAuthRedirectRuntime({
      environment: 'local',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        APP_PORT_FORWARD_LOCAL_PORT: '19006',
        SUPABASE_GATEWAY_FORWARD_LOCAL_PORT: '54321',
        OAUTH_NATIVE_REDIRECT_URLS: 'ankh-example://auth/callback',
      },
    });

    expect(runtime.providerRedirectUrl).toBe(
      'http://127.0.0.1:54321/auth/v1/callback',
    );
    expect(runtime.appCallbackTargets).toContain(
      'http://127.0.0.1:19006/auth/callback',
    );
    expect(runtime.appCallbackTargets).toContain(
      'http://localhost:*/auth/callback',
    );
    expect(runtime.appCallbackTargets).toContain(
      'http://127.0.0.1:*/auth/callback',
    );
    expect(runtime.appCallbackTargets).toContain('ankh-example://auth/callback');
  });

  test('keeps callback groups distinct for concurrently generated projects', () => {
    const first = resolveProjectAuthRedirectRuntime({
      environment: 'local',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        APP_PORT_FORWARD_LOCAL_PORT: '19006',
        SUPABASE_GATEWAY_FORWARD_LOCAL_PORT: '54321',
      },
    });
    const second = resolveProjectAuthRedirectRuntime({
      environment: 'local',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        APP_PORT_FORWARD_LOCAL_PORT: '19007',
        SUPABASE_GATEWAY_FORWARD_LOCAL_PORT: '54322',
      },
    });

    expect(second.providerRedirectUrl).not.toBe(first.providerRedirectUrl);
    expect(second.appCallbackTargets[0]).not.toBe(first.appCallbackTargets[0]);
  });

  test('uses exact production callbacks without local wildcard leakage', () => {
    const runtime = resolveProjectAuthRedirectRuntime({
      environment: 'production',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        SITE_URL: 'https://example.com',
        API_EXTERNAL_URL: 'https://api.example.com/auth/v1',
      },
    });

    expect(runtime.providerRedirectUrl).toBe(
      'https://api.example.com/auth/v1/callback',
    );
    expect(runtime.appCallbackTargets).toEqual([
      'https://example.com/auth/callback',
    ]);
    expect(runtime.redirectAllowList.some((target) => target.includes('*'))).toBeFalse();
    expect(runtime.redirectAllowList.some((target) => target.includes('localhost'))).toBeFalse();
  });

  test('includes native callbacks only when generated Infra enables them', () => {
    const withoutNative = resolveProjectAuthRedirectRuntime({
      environment: 'local',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        APP_PORT_FORWARD_LOCAL_PORT: '19006',
        SUPABASE_GATEWAY_FORWARD_LOCAL_PORT: '54321',
      },
    });
    const withNative = resolveProjectAuthRedirectRuntime({
      environment: 'local',
      callbackRoute: '/auth/callback',
      infraEnvironment: {
        APP_PORT_FORWARD_LOCAL_PORT: '19006',
        SUPABASE_GATEWAY_FORWARD_LOCAL_PORT: '54321',
        OAUTH_NATIVE_REDIRECT_URLS:
          'ankh-example://auth/callback,ankh-example-dev://auth/callback',
      },
    });

    expect(withoutNative.appCallbackTargets.some((target) => target.startsWith('ankh-'))).toBeFalse();
    expect(withNative.appCallbackTargets).toContain('ankh-example://auth/callback');
    expect(withNative.appCallbackTargets).toContain(
      'ankh-example-dev://auth/callback',
    );
  });
});

describe('parseProjectAuthRuntimeStatus', () => {
  test('reads only safe callback and readiness fields from generated Infra status', () => {
    const status = parseProjectAuthRuntimeStatus(`
provider supabase-auth/provider-callback: http://127.0.0.1:54321/auth/v1/callback
provider supabase-auth/app-callback: http://127.0.0.1:19006/auth/callback
provider supabase-auth/GoTrue: ready
GOTRUE_EXTERNAL_GOOGLE_SECRET=must-not-be-returned
`);

    expect(status).toEqual({
      rolloutStatus: 'ready',
      providerRedirectUrl: 'http://127.0.0.1:54321/auth/v1/callback',
      appCallbackUrl: 'http://127.0.0.1:19006/auth/callback',
    });
    expect(JSON.stringify(status)).not.toContain('must-not-be-returned');
  });

  test('reports an explicit failed readiness check', () => {
    expect(
      parseProjectAuthRuntimeStatus('provider supabase-auth/GoTrue: not ready'),
    ).toEqual({ rolloutStatus: 'not-ready' });
  });

  test('does not treat arbitrary script output as runtime diagnostics', () => {
    expect(
      parseProjectAuthRuntimeStatus('clientSecret=hidden\naccess_token=hidden'),
    ).toEqual({ rolloutStatus: 'unavailable' });
  });
});
