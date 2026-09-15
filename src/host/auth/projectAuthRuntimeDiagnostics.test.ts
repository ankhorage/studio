import type { InfraOutput, InfraResourceIdentity, InfraStatus } from '@ankhorage/contracts/infra';
import { describe, expect, test } from 'bun:test';

import {
  observeProjectAuthRuntimeDiagnostics,
  resolveProjectAuthRedirectRuntime,
} from './projectAuthRuntimeDiagnostics';

const owner: InfraResourceIdentity = {
  projectId: 'demo',
  environment: 'local',
  adapter: 'supabase',
  resourceId: 'gateway',
};
const supabaseOutput: InfraOutput = {
  owner,
  name: 'url',
  visibility: 'public',
  value: 'http://127.0.0.1:54321',
  environmentVariable: 'EXPO_PUBLIC_SUPABASE_URL',
};

function createStatus(state: InfraStatus['state']): InfraStatus {
  return { projectId: 'demo', environment: 'local', state, resources: [] };
}

describe('resolveProjectAuthRedirectRuntime', () => {
  test('derives provider and public app callbacks from provider-neutral outputs', () => {
    const runtime = resolveProjectAuthRedirectRuntime({
      callbackRoute: '/auth/callback',
      outputs: [supabaseOutput],
      publicBaseUrl: 'https://example.com',
    });

    expect(runtime.providerRedirectUrl).toBe('http://127.0.0.1:54321/auth/v1/callback');
    expect(runtime.appCallbackTargets).toEqual(['https://example.com/auth/callback']);
    expect(runtime.redirectAllowList).toEqual([
      'https://example.com/',
      'https://example.com/auth/callback',
    ]);
  });

  test('keeps application callback targets empty without authored public networking intent', () => {
    const runtime = resolveProjectAuthRedirectRuntime({
      callbackRoute: '/auth/callback',
      outputs: [supabaseOutput],
    });

    expect(runtime.providerRedirectUrl).toBe('http://127.0.0.1:54321/auth/v1/callback');
    expect(runtime.appCallbackTargets).toEqual([]);
    expect(runtime.redirectAllowList).toEqual([]);
  });

  test('rejects diagnostics when the public Supabase output is absent', () => {
    expect(() =>
      resolveProjectAuthRedirectRuntime({ callbackRoute: '/auth/callback', outputs: [] }),
    ).toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });
});

describe('observeProjectAuthRuntimeDiagnostics', () => {
  test('maps provider-neutral ready state without parsing provider scripts', () => {
    expect(
      observeProjectAuthRuntimeDiagnostics({
        callbackRoute: '/auth/callback',
        outputs: [supabaseOutput],
        publicBaseUrl: 'https://example.com',
        status: createStatus('ready'),
      }).rolloutStatus,
    ).toBe('ready');
  });

  test('maps absent and failed runtime state conservatively', () => {
    expect(
      observeProjectAuthRuntimeDiagnostics({
        callbackRoute: '/auth/callback',
        outputs: [supabaseOutput],
        status: createStatus('absent'),
      }).rolloutStatus,
    ).toBe('not-generated');
    expect(
      observeProjectAuthRuntimeDiagnostics({
        callbackRoute: '/auth/callback',
        outputs: [supabaseOutput],
        status: createStatus('failed'),
      }).rolloutStatus,
    ).toBe('not-ready');
  });
});
