import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { NATIVE_EVIDENCE_IOS_SCHEME, NATIVE_EVIDENCE_STUDIO_VERSION } from './constants';
import { createGenerationDriverSource } from './createGenerationDriverSource';
import { createNativeEvidenceClientSource } from './createNativeEvidenceClientSource';
import { createNativeEvidenceControllerSource } from './createNativeEvidenceControllerSource';
import { createNativeEvidenceRouteSource } from './createNativeEvidenceRouteSource';
import { createNativeEvidenceScenariosSource } from './createNativeEvidenceScenariosSource';
import { createNativeEvidenceScreenSource } from './createNativeEvidenceScreenSource';
import { createNativeEvidenceServer } from './createNativeEvidenceServer';

const temporaryRoots = new Set<string>();
const servers = new Set<ReturnType<typeof Bun.serve>>();

afterEach(async () => {
  for (const server of servers) {
    await server.stop(true);
    servers.delete(server);
  }
  await Promise.all(
    [...temporaryRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      temporaryRoots.delete(root);
    }),
  );
});

describe('Expo 57 native capability evidence harness', () => {
  it('generates through the released Studio host and keeps the app route thin', () => {
    const driver = createGenerationDriverSource('/tmp/native-evidence-test');
    const controller = createNativeEvidenceControllerSource();
    const route = createNativeEvidenceRouteSource();
    const scenarios = createNativeEvidenceScenariosSource();
    const screen = createNativeEvidenceScreenSource();

    expect(NATIVE_EVIDENCE_STUDIO_VERSION).toBe('2.0.6');
    expect(driver).toContain("import { ProjectManager } from '@ankhorage/studio/host';");
    expect(driver).toContain("import { PERMISSIONS } from '@ankhorage/permissions';");
    expect(driver).toContain("import { createOAuthFixtureManifest } from '@ankhorage/templates';");
    expect(driver).toContain('permissions: PERMISSIONS.map((permission) => ({ permission }))');
    expect(driver).not.toContain('const permissionNames');
    expect(route.trim()).toBe(
      "export { NativeEvidenceScreen as default } from '@/native-evidence/native-evidence-screen';",
    );
    expect(scenarios).toContain("createPermissionClient } from '@ankhorage/permissions/expo'");
    expect(scenarios).toContain(
      "createExpoMediaPickerAdapter } from '@ankhorage/expo-runtime/media-picker'",
    );
    expect(scenarios).toContain('CameraView.isAvailableAsync()');
    expect(scenarios).toContain('WebBrowser.dismissAuthSession();');
    expect(scenarios).not.toContain('dismissAuthSession().catch');
    expect(scenarios).toContain("router.replace('/')");
    expect(controller).toContain('new AbortController()');
    expect(controller).toContain('readNativeEvidenceCommandAsync(controller.signal)');
    expect(controller).toContain('claimedEvidenceCommandRevisions.has(command.revision)');
    expect(controller).toContain('signal: controller.signal');
    expect(screen).toContain('useNativeEvidenceController()');
    expect(screen).not.toContain('console.');
  });

  it('records only allowlisted status evidence and rejects sensitive fields', async () => {
    const root = await mkdtemp('/tmp/ankh-native-evidence-server-');
    temporaryRoots.add(root);
    const server = createNativeEvidenceServer({ port: 0, workspaceRoot: root });
    servers.add(server);
    const baseUrl = `http://127.0.0.1:${server.port}`;

    const command = await fetch(`${baseUrl}/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permission: 'camera', scenario: 'permission-status' }),
    });
    expect(command.status).toBe(200);
    expect(await fetch(`${baseUrl}/command`).then((response) => response.json())).toEqual({
      permission: 'camera',
      revision: 1,
      scenario: 'permission-status',
    });
    expect(await fetch(`${baseUrl}/command`).then((response) => response.json())).toEqual({
      permission: 'camera',
      revision: 1,
      scenario: 'permission-status',
    });

    const accepted = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scenario: 'permission-status',
        result: 'blocked',
        details: { canAskAgain: false, permission: 'camera' },
      }),
    });
    expect(accepted.status).toBe(200);
    expect(await fetch(`${baseUrl}/command`).then((response) => response.json())).toEqual({
      revision: 1,
      scenario: 'session-restored',
    });

    const rejected = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scenario: 'oauth-success',
        result: 'authenticated',
        details: { accessToken: 'must-not-be-recorded' },
      }),
    });
    expect(rejected.status).toBe(400);

    const rejectedPayload = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scenario: 'oauth-success',
        result: 'authenticated',
        details: { payload: 'must-not-be-recorded' },
      }),
    });
    expect(rejectedPayload.status).toBe(400);

    const rejectedOutcome = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: 'oauth-success', result: 'arbitrary-result' }),
    });
    expect(rejectedOutcome.status).toBe(400);

    const log = await readFile(path.join(root, 'evidence', 'native-results.ndjson'), 'utf8');
    expect(log).toContain('"permission":"camera"');
    expect(log).not.toContain('must-not-be-recorded');
    expect(log).not.toContain('accessToken');
  });

  it('redirects the deterministic provider only to the configured native callback', async () => {
    const root = await mkdtemp('/tmp/ankh-native-oauth-server-');
    temporaryRoots.add(root);
    const server = createNativeEvidenceServer({ port: 0, workspaceRoot: root });
    servers.add(server);
    const authorize = new URL(`http://127.0.0.1:${server.port}/auth/v1/authorize`);
    authorize.searchParams.set('redirect_to', `${NATIVE_EVIDENCE_IOS_SCHEME}://auth/callback`);

    const response = await fetch(authorize, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toStartWith(
      `${NATIVE_EVIDENCE_IOS_SCHEME}://auth/callback?code=`,
    );

    const replay = await fetch(`${authorize.origin}/auth/replay`, { redirect: 'manual' });
    const mismatch = await fetch(`${authorize.origin}/auth/mismatch`, { redirect: 'manual' });

    expect(replay.headers.get('location')).toBe(response.headers.get('location'));
    expect(mismatch.headers.get('location')).not.toBe(response.headers.get('location'));
    expect(mismatch.headers.get('location')).toStartWith(
      `${NATIVE_EVIDENCE_IOS_SCHEME}://auth/callback?code=`,
    );
  });

  it('counts PKCE exchanges separately from refresh and unknown token requests', async () => {
    const root = await mkdtemp('/tmp/ankh-native-token-counts-');
    temporaryRoots.add(root);
    const server = createNativeEvidenceServer({ port: 0, workspaceRoot: root });
    servers.add(server);
    const baseUrl = `http://127.0.0.1:${server.port}`;

    await fetch(`${baseUrl}/auth/v1/token?grant_type=pkce`, { method: 'POST' });
    await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, { method: 'POST' });
    await fetch(`${baseUrl}/auth/v1/token`, { method: 'POST' });

    const state: unknown = await fetch(`${baseUrl}/state`).then((response) => response.json());
    expect(state).toMatchObject({
      refreshTokenRequestCount: 1,
      tokenExchangeCount: 1,
      unknownTokenRequestCount: 1,
    });
  });

  it('never embeds a fixture URL or sensitive auth value in the generated client', () => {
    const client = createNativeEvidenceClientSource();

    expect(client).toContain('EXPO_PUBLIC_NATIVE_EVIDENCE_URL');
    expect(client).toContain('platform: Platform.OS');
    expect(client).not.toContain('process.env');
    expect(client).not.toContain('127.0.0.1');
    expect(client).not.toContain('access_token');
    expect(client).not.toContain('refresh_token');
  });
});
