import { describe, expect, test } from 'bun:test';

import type { ProjectAuthHealth } from './projectAuthHealth';
import { applyProjectAuthRuntimeDiagnostics } from './projectAuthRuntimeDiagnostics';

const healthyDesiredState: ProjectAuthHealth = {
  status: 'healthy',
  diagnostics: [],
  providers: [],
  callbackUrls: {
    appCallbackRoute: '/auth/callback',
  },
};

describe('applyProjectAuthRuntimeDiagnostics', () => {
  test('adds exact callback targets and a ready rollout without introducing an error', () => {
    const health = applyProjectAuthRuntimeDiagnostics(healthyDesiredState, {
      providerRedirectUrl: 'http://127.0.0.1:54321/auth/v1/callback',
      appCallbackTargets: [
        'http://127.0.0.1:19006/auth/callback',
        'http://localhost:*/auth/callback',
        'ankh-example://auth/callback',
      ],
      redirectAllowList: [
        'http://127.0.0.1:19006',
        'http://127.0.0.1:19006/auth/callback',
        'http://localhost:*/auth/callback',
        'ankh-example://auth/callback',
      ],
      rolloutStatus: 'ready',
    });

    expect(health.status).toBe('healthy');
    expect(health.callbackUrls.providerRedirectUrl).toBe('http://127.0.0.1:54321/auth/v1/callback');
    expect(health.diagnostics.map((diagnostic) => diagnostic.code)).toContain('auth_runtime_ready');
    expect(
      health.diagnostics.filter((diagnostic) => diagnostic.code === 'app_callback_target'),
    ).toHaveLength(3);
  });

  test('makes a not-ready runtime an error even when desired state is healthy', () => {
    const health = applyProjectAuthRuntimeDiagnostics(healthyDesiredState, {
      appCallbackTargets: [],
      redirectAllowList: [],
      rolloutStatus: 'not-ready',
    });

    expect(health.status).toBe('error');
    expect(health.diagnostics[0]?.code).toBe('auth_runtime_not_ready');
  });

  test('preserves desired-state errors while adding safe runtime diagnostics', () => {
    const health = applyProjectAuthRuntimeDiagnostics(
      {
        ...healthyDesiredState,
        status: 'error',
        diagnostics: [
          {
            code: 'provider_secret_incomplete',
            severity: 'error',
            message: 'OAuth provider secret metadata is incomplete.',
          },
        ],
      },
      {
        appCallbackTargets: [],
        redirectAllowList: [],
        rolloutStatus: 'ready',
      },
    );

    expect(health.status).toBe('error');
    expect(health.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'provider_secret_incomplete',
      'auth_runtime_ready',
    ]);
  });
});
