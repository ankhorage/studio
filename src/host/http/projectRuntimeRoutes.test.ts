import { InfraScriptExecutionError } from '@ankhorage/infra/project';
import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerProjectRuntimeRoutes } from './projectRuntimeRoutes';

const servers: FastifyInstance[] = [];
const generatedStatus = {
  generated: true,
  generatedAt: '2026-08-22T00:00:00.000Z',
  hasDeployment: true,
  target: 'minikube',
  trackedFiles: 5,
  warnings: [],
} as const;

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('project runtime HTTP adapter', () => {
  test('runtime ensure is provider-neutral and never touches app-forward APIs', async () => {
    const ensured: unknown[] = [];
    const server = createServer({
      resolveProjectInfrastructurePortForward: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      runProjectInfrastructureLifecycle: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      ensureProjectInfrastructureRuntime: (args) => {
        ensured.push(args);
        return Promise.resolve({ stdout: '', stderr: '' });
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body) as unknown).toEqual({
      success: true,
      target: 'minikube',
    });
    expect(ensured).toEqual([
      {
        projectId: 'project-one',
        projectPath: '/workspace/apps/project-one',
        target: 'minikube',
      },
    ]);
  });

  for (const scenario of [
    { status: 'app: running\n', started: false },
    { status: 'app: stopped\n', started: true },
  ] as const) {
    test(`launch preserves Web app behavior when ${scenario.status.trim()}`, async () => {
      const calls: string[] = [];
      const server = createServer({
        resolveProjectInfrastructurePortForward: () => {
          calls.push('resolve-app-endpoint');
          return Promise.resolve({ localPort: 48_123, url: 'http://127.0.0.1:48123' });
        },
        runProjectInfrastructureLifecycle: () => {
          calls.push('read-app-status');
          return Promise.resolve({ stdout: scenario.status, stderr: '' });
        },
        ensureProjectInfrastructureRuntime: () => {
          calls.push('ensure-runtime');
          return Promise.resolve({ stdout: '', stderr: '' });
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/projects/project-one/launch',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body) as unknown).toEqual({
        success: true,
        target: 'minikube',
        url: 'http://127.0.0.1:48123',
        started: scenario.started,
      });
      expect(calls).toEqual(['resolve-app-endpoint', 'read-app-status', 'ensure-runtime']);
    });
  }

  test('returns exact Infra runtime failure text with guidance appended once', async () => {
    const failureMessage =
      "Failed to ensure infrastructure runtime for project 'project-one': unknown group runtime";
    const guidance =
      "Run Infrastructure Up to regenerate project 'project-one' infrastructure before retrying.";
    const server = createServer({
      resolveProjectInfrastructurePortForward: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      runProjectInfrastructureLifecycle: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      ensureProjectInfrastructureRuntime: () =>
        Promise.reject(
          new InfraScriptExecutionError({
            exitCode: 1,
            message: failureMessage,
            stderr: 'unknown group runtime',
            stdout: 'runtime output',
          }),
        ),
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body) as { readonly error: string };
    expect(body.error).toContain(failureMessage);
    expect(body.error.split(guidance)).toHaveLength(2);
  });

  test('both routes preserve skipped-project behavior without starting a runtime', async () => {
    const server = createServer(throwingDependencies(), {
      ...generatedStatus,
      generated: false,
      hasDeployment: false,
      target: null,
      skipped: { reason: 'Studio is not a generated app target.' },
    });

    for (const url of [
      '/api/projects/project-one/launch',
      '/api/projects/project-one/infra/runtime/ensure',
    ]) {
      const response = await server.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body) as unknown).toEqual({
        success: true,
        skipped: { reason: 'Studio is not a generated app target.' },
      });
    }
  });

  test('both routes preserve no-target guidance without starting a runtime', async () => {
    const server = createServer(throwingDependencies(), { ...generatedStatus, target: null });

    for (const url of [
      '/api/projects/project-one/launch',
      '/api/projects/project-one/infra/runtime/ensure',
    ]) {
      const response = await server.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body) as unknown).toEqual({
        error: "Project 'project-one' has no infrastructure target. Run Infrastructure Up first.",
      });
    }
  });
});

function createServer(
  dependencies: NonNullable<Parameters<typeof registerProjectRuntimeRoutes>[1]['dependencies']>,
  status: Awaited<
    ReturnType<
      Parameters<
        typeof registerProjectRuntimeRoutes
      >[1]['projectManager']['getInfrastructureStatus']
    >
  > = generatedStatus,
): FastifyInstance {
  const server = Fastify({ logger: false });
  registerProjectRuntimeRoutes(server, {
    workspaceRoot: '/workspace',
    projectManager: {
      getInfrastructureStatus: () => Promise.resolve(status),
    },
    dependencies,
  });
  servers.push(server);
  return server;
}

function throwingDependencies(): NonNullable<
  Parameters<typeof registerProjectRuntimeRoutes>[1]['dependencies']
> {
  return {
    resolveProjectInfrastructurePortForward: () => {
      throw new Error('MUST NOT BE CALLED');
    },
    runProjectInfrastructureLifecycle: () => {
      throw new Error('MUST NOT BE CALLED');
    },
    ensureProjectInfrastructureRuntime: () => {
      throw new Error('MUST NOT BE CALLED');
    },
  };
}
