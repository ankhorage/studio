import { expect, test } from 'bun:test';

import { ProjectDeployApiError } from './projectDeployApiError';
import { ProjectDeployClient } from './projectDeployClient';
import type { ProjectDeployRequest } from './projectDeployRequest';

test('public Deploy API module is import-safe without booting Expo or React Native', async () => {
  const api = await import('./projectDeployApi');
  expect(typeof api.readProjectDeployConfig).toBe('function');
  expect(typeof api.inspectProjectDeployRelease).toBe('function');
});

test('Deploy client consumes canonical owner responses through the request port', async () => {
  const requests: string[] = [];
  const request: ProjectDeployRequest = (path) => {
    requests.push(path);
    return Promise.resolve(
      path.endsWith('/config')
        ? Response.json({ targets: { web: { enabled: true } } })
        : Response.json({ revision: 'listing-r1', locales: [], assetSets: [] }),
    );
  };
  const client = new ProjectDeployClient(request);

  expect(await client.readConfig('demo')).toEqual({
    targets: { web: { enabled: true } },
  });
  expect(await client.readListing('demo')).toMatchObject({ revision: 'listing-r1' });
  expect(requests).toEqual(['/projects/demo/deploy/config', '/projects/demo/deploy/listing']);
});

test('Deploy client rejects raw secret-shaped response fields', async () => {
  const request: ProjectDeployRequest = () =>
    Promise.resolve(
      Response.json({
        targets: {},
        token: 'must-never-cross-the-browser-bridge',
      }),
    );
  const client = new ProjectDeployClient(request);

  const error = await captureProjectDeployApiError(() => client.readConfig('demo'));

  expect(error.status).toBe(502);
  expect(error.message).toContain('forbidden secret-shaped field');
});

test('Deploy client preserves structured HTTP failures as errors', async () => {
  const request: ProjectDeployRequest = () =>
    Promise.resolve(Response.json({ error: 'Prepared release is missing.' }, { status: 400 }));
  const client = new ProjectDeployClient(request);

  const error = await captureProjectDeployApiError(() => client.readListing('demo'));

  expect(error.status).toBe(400);
  expect(error.message).toContain('Prepared release is missing.');
});

test('Deploy client sends readiness runtime only to the inspect owner endpoint', async () => {
  const requests: { readonly path: string; readonly init?: RequestInit }[] = [];
  const request: ProjectDeployRequest = (path, init) => {
    requests.push({ path, init });
    return Promise.resolve(
      Response.json({
        ok: false,
        failure: {
          code: 'GOOGLE_PLAY_AUTHENTICATION_REQUIRED',
          message: 'Google Play authentication required.',
        },
      }),
    );
  };
  const client = new ProjectDeployClient(request);

  const result = await client.inspectRelease({
    projectId: 'demo project',
    runtime: {
      environment: 'preview',
      android: { track: 'internal' },
    },
  });

  expect(result).toEqual({
    ok: false,
    failure: {
      code: 'GOOGLE_PLAY_AUTHENTICATION_REQUIRED',
      message: 'Google Play authentication required.',
    },
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]?.path).toBe('/projects/demo%20project/deploy/release/inspect');
  expect(requests[0]?.init?.method).toBe('POST');
  expect(requests[0]?.init?.body).toBe(
    JSON.stringify({
      environment: 'preview',
      android: { track: 'internal' },
    }),
  );
});

async function captureProjectDeployApiError(
  action: () => Promise<unknown>,
): Promise<ProjectDeployApiError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof ProjectDeployApiError) return error;
    throw error;
  }
  throw new Error('Expected ProjectDeployApiError.');
}
