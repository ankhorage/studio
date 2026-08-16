import type { ReleasePlan } from '@ankhorage/deploy';
import type { ProjectReleaseInspection } from '@ankhorage/deploy/project';
import { expect, test } from 'bun:test';

import { ProjectDeployApiError } from './projectDeployApiError';
import { ProjectDeployClient } from './projectDeployClient';
import type { ProjectDeployRequest } from './projectDeployRequest';

test('public Deploy API module is import-safe without booting Expo or React Native', async () => {
  const api = await import('./projectDeployApi');
  expect(typeof api.readProjectDeployConfig).toBe('function');
  expect(typeof api.inspectProjectDeployRelease).toBe('function');
  expect(typeof api.executeProjectDeployRelease).toBe('function');
  expect(typeof api.resumeProjectDeployRelease).toBe('function');
  expect(typeof api.executeProjectDeployReleaseControl).toBe('function');
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
  expect(await client.readConfig('demo')).toEqual({ targets: { web: { enabled: true } } });
  expect(await client.readListing('demo')).toMatchObject({ revision: 'listing-r1' });
  expect(requests).toEqual(['/projects/demo/deploy/config', '/projects/demo/deploy/listing']);
});

test('Deploy client rejects raw secret-shaped response fields', async () => {
  const request: ProjectDeployRequest = () =>
    Promise.resolve(Response.json({ targets: {}, token: 'must-never-cross-the-browser-bridge' }));
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
    runtime: { environment: 'preview', android: { track: 'internal' } },
  });
  expect(result.ok).toBe(false);
  expect(requests[0]?.path).toBe('/projects/demo%20project/deploy/release/inspect');
  expect(requests[0]?.init?.body).toBe(
    JSON.stringify({ environment: 'preview', android: { track: 'internal' } }),
  );
});

test('Deploy client executes the exact inspected snapshot without a client execution id', async () => {
  const requests: { readonly path: string; readonly init?: RequestInit }[] = [];
  const inspection = releaseInspection();
  const plan = releasePlan();
  const request: ProjectDeployRequest = (path, init) => {
    requests.push({ path, init });
    return Promise.resolve(
      Response.json({
        executionId: 'host-execution-1',
        result: {
          ok: true,
          execution: {
            result: {
              status: 'completed',
              plan,
              currentRevision: 'current-r2',
              executedStepIds: ['web:publish'],
            },
            historyRecorded: true,
          },
        },
      }),
    );
  };
  const client = new ProjectDeployClient(request);
  const runtime = { environment: 'production' as const };
  const response = await client.executeRelease({ projectId: 'demo', runtime, inspection, plan });
  expect(response.executionId).toBe('host-execution-1');
  expect(requests[0]?.path).toBe('/projects/demo/deploy/release/execute');
  expect(requests[0]?.init?.body).toBe(JSON.stringify({ runtime, inspection, plan }));
});

test('Deploy client uses owner resume and lifecycle-control endpoints', async () => {
  const paths: string[] = [];
  const request: ProjectDeployRequest = (path) => {
    paths.push(path);
    if (path.endsWith('/control')) {
      return Promise.resolve(Response.json({ status: 'completed', mutationAttempted: true }));
    }
    return Promise.resolve(
      Response.json({
        executionId: 'resume-2',
        result: {
          ok: false,
          failure: { code: 'RELEASE_BLOCKED', message: 'Release is blocked.' },
        },
      }),
    );
  };
  const client = new ProjectDeployClient(request);
  const runtime = { environment: 'production' as const };
  await client.resumeRelease({ projectId: 'demo', runtime, previousExecutionId: 'execution-1' });
  await client.executeReleaseControl({
    projectId: 'demo',
    runtime,
    control: { target: 'android', action: 'halt' },
  });
  expect(paths).toEqual([
    '/projects/demo/deploy/release/resume',
    '/projects/demo/deploy/release/control',
  ]);
});

function releaseInspection(): ProjectReleaseInspection {
  return {
    projectRoot: '/tmp/demo',
    desired: {
      version: '1.0.0',
      targets: ['web'],
      notes: [],
      rollout: {},
      revision: 'desired-r1',
    },
    observed: { targets: [] },
    currentRevision: 'current-r1',
    actions: [],
  };
}

function releasePlan(): ReleasePlan {
  return {
    status: 'changes',
    desiredRevision: 'desired-r1',
    currentRevision: 'current-r1',
    steps: [
      {
        id: 'web:publish',
        target: 'web',
        operation: 'publish',
        dependsOn: [],
        retry: 'safe',
        irreversible: false,
      },
    ],
    diagnostics: [],
  };
}

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
