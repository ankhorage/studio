import { expect, test } from 'bun:test';

import { createProjectDeployAccess } from './createProjectDeployAccess';
import type { ProjectDeploySecretStore } from './ProjectDeploySecretStore';

const SECRET_SENTINEL = 'DEPLOY_SECRET_SENTINEL';

test('deploy access exposes metadata references but resolves secret material only on demand', async () => {
  const store: ProjectDeploySecretStore = {
    list: () =>
      Promise.resolve({
        ok: true,
        data: [
          {
            ref: 'deploy/google-play',
            scope: { projectId: 'demo', environment: 'production' },
            kind: 'service-account',
            provider: 'google-play',
            configuredFields: ['type', 'client_email', 'private_key'],
            createdAt: '2026-08-14T00:00:00.000Z',
            updatedAt: '2026-08-14T00:00:00.000Z',
          },
        ],
      }),
    resolve: () =>
      Promise.resolve({
        ok: true,
        data: {
          type: 'service_account',
          client_email: 'deploy@example.com',
          private_key: SECRET_SENTINEL,
        },
      }),
  };

  const access = await createProjectDeployAccess({
    projectId: 'demo',
    runtime: { environment: 'production' },
    secretStore: store,
  });

  expect(access.credentials).toEqual([
    {
      id: 'deploy/google-play',
      provider: 'google-play',
      kind: 'service-account',
    },
  ]);
  expect(JSON.stringify(access.credentials)).not.toContain(SECRET_SENTINEL);
  const reference = access.credentials?.[0];
  expect(reference).toBeDefined();
  if (!reference || !access.resolveSecret)
    throw new Error('Expected deployment credential access.');
  expect(await access.resolveSecret(reference)).toContain(SECRET_SENTINEL);
});

test('EAS token payload is adapted to the raw Deploy secret boundary', async () => {
  const store: ProjectDeploySecretStore = {
    list: () =>
      Promise.resolve({
        ok: true,
        data: [
          {
            ref: 'deploy/eas',
            scope: { projectId: 'demo', environment: 'preview' },
            kind: 'expo-token',
            provider: 'eas',
            configuredFields: ['token'],
            createdAt: '2026-08-14T00:00:00.000Z',
            updatedAt: '2026-08-14T00:00:00.000Z',
          },
        ],
      }),
    resolve: () => Promise.resolve({ ok: true, data: { token: SECRET_SENTINEL } }),
  };

  const access = await createProjectDeployAccess({
    projectId: 'demo',
    runtime: { environment: 'preview' },
    secretStore: store,
  });
  const reference = access.credentials?.[0];
  if (!reference || !access.resolveSecret) throw new Error('Expected EAS credential access.');
  expect(await access.resolveSecret(reference)).toBe(SECRET_SENTINEL);
});

test('unlisted references cannot be resolved through the trusted adapter', async () => {
  let resolved = false;
  const store: ProjectDeploySecretStore = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    resolve: () => {
      resolved = true;
      return Promise.resolve({ ok: true, data: { token: SECRET_SENTINEL } });
    },
  };
  const access = await createProjectDeployAccess({
    projectId: 'demo',
    runtime: { environment: 'production' },
    secretStore: store,
  });
  if (!access.resolveSecret) throw new Error('Expected resolver.');
  expect(
    await access.resolveSecret({
      id: 'deploy/unknown',
      provider: 'eas',
      kind: 'expo-token',
    }),
  ).toBeNull();
  expect(resolved).toBeFalse();
});
