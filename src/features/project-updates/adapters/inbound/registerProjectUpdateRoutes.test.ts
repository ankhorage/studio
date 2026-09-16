import type { ApmPlanResult } from '@ankhorage/apm/types';
import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerProjectUpdateRoutes } from './registerProjectUpdateRoutes';

const ROOT = '/workspace/apps/project-one';
const servers: FastifyInstance[] = [];
const permissions = {
  ownerCode: true,
  lifecycleScripts: false,
  externalEffects: false,
} as const;
const plan: ApmPlanResult = {
  schemaVersion: 2,
  operation: 'plan',
  id: 'plan-one',
  rootPath: ROOT,
  complete: true,
  policy: {
    dependencyUpdates: 'none',
    selections: [],
    repairInstallations: false,
    repairProjections: false,
    maxGeneratorIterations: 1,
  },
  executor: { apmVersion: '0.8.1', runtime: 'node' },
  inputFingerprint: { value: 'fingerprint', statusSchemaVersion: 2, availabilityCheckedAt: [] },
  targets: [],
  files: [],
  packages: [],
  artifacts: [],
  steps: [],
  effects: [],
  findings: [],
  blockers: [],
  diagnostics: [],
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('project update HTTP adapter', () => {
  test('resolves status from the selected project id and rejects caller-supplied roots', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);

    const response = await server.inject({
      method: 'GET',
      url: '/api/projects/project-one/updates/status?availability=offline',
    });
    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      { operation: 'status', input: { rootPath: ROOT, availability: 'offline' } },
    ]);

    const injected = await server.inject({
      method: 'GET',
      url: '/api/projects/project-one/updates/status?rootPath=%2Ftmp%2Fevil',
    });
    expect(injected.statusCode).toBe(400);
    expect(calls).toHaveLength(1);
  });

  test('plans through the server-owned root with bounded policy input', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/plan',
      payload: {
        availability: 'refresh',
        policy: { dependencyUpdates: 'safe', repairProjections: true },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        operation: 'plan',
        input: {
          rootPath: ROOT,
          availability: 'refresh',
          policy: { dependencyUpdates: 'safe', repairProjections: true },
        },
      },
    ]);
  });

  test('starts only the reviewed plan for the selected project with explicit permissions', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/apply',
      payload: { plan, permissions },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{ operation: 'apply', input: { mode: 'start', plan, permissions } }]);

    const mismatched = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/apply',
      payload: { plan: { ...plan, rootPath: '/workspace/apps/other' }, permissions },
    });
    expect(mismatched.statusCode).toBe(409);
    expect(calls).toHaveLength(1);
  });

  test('accepts a reviewed apply plan above the global Fastify body limit', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);
    const largePlan: ApmPlanResult = {
      ...plan,
      files: [
        {
          path: 'bun.lock',
          kind: 'update',
          beforeContent: 'before',
          beforeDigest: 'before-digest',
          afterContent: 'x'.repeat(2 * 1024 * 1024),
          afterDigest: 'after-digest',
        },
      ],
    };

    const applied = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/apply',
      payload: { plan: largePlan, permissions },
    });
    expect(applied.statusCode).toBe(200);
    expect(calls).toEqual([
      { operation: 'apply', input: { mode: 'start', plan: largePlan, permissions } },
    ]);
  });

  test('resumes one durable operation through the selected project root', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls, { applyStatus: 'blocked' });
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/resume',
      payload: { operationId: 'operation-one', permissions },
    });

    expect(response.statusCode).toBe(409);
    expect(calls).toEqual([
      {
        operation: 'apply',
        input: { mode: 'resume', rootPath: ROOT, operationId: 'operation-one', permissions },
      },
    ]);
  });

  test('verifies by operation id and returns not-found before invoking APM for unknown projects', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);
    const verified = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/verify',
      payload: { operationId: 'operation-one' },
    });
    expect(verified.statusCode).toBe(200);
    expect(calls).toEqual([
      { operation: 'verify', input: { rootPath: ROOT, operationId: 'operation-one' } },
    ]);

    const missing = await server.inject({
      method: 'POST',
      url: '/api/projects/missing/updates/verify',
      payload: { operationId: 'operation-one' },
    });
    expect(missing.statusCode).toBe(404);
    expect(calls).toHaveLength(1);
  });

  test('rejects mutation requests without the complete explicit permission envelope', async () => {
    const calls: unknown[] = [];
    const server = createServer(calls);
    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/updates/resume',
      payload: {
        operationId: 'operation-one',
        permissions: { ownerCode: true, lifecycleScripts: false },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });
});

/*** Create one isolated Fastify fixture around a fake APM lifecycle port. */
function createServer(
  calls: unknown[],
  options: { readonly applyStatus?: 'completed' | 'blocked' } = {},
): FastifyInstance {
  const server = Fastify({ logger: false });
  const service: Parameters<typeof registerProjectUpdateRoutes>[1]['service'] = {
    statusAsync: (input) => {
      calls.push({ operation: 'status', input });
      return Promise.resolve({ schemaVersion: 1, operation: 'status' });
    },
    planAsync: (input) => {
      calls.push({ operation: 'plan', input });
      return Promise.resolve({ ...plan, rootPath: input.rootPath });
    },
    applyAsync: (input) => {
      calls.push({ operation: 'apply', input });
      return Promise.resolve({
        schemaVersion: 1,
        operation: 'apply',
        operationId: 'operation-one',
        rootPath: ROOT,
        status: options.applyStatus ?? 'completed',
        complete: options.applyStatus !== 'blocked',
        blockers: [],
        diagnostics: [],
      });
    },
    verifyAsync: (input) => {
      calls.push({ operation: 'verify', input });
      return Promise.resolve({
        schemaVersion: 1,
        operation: 'verify',
        operationId: input.operationId,
        rootPath: input.rootPath,
        verified: true,
        checks: [],
        findings: [],
        followUp: [],
        diagnostics: [],
      });
    },
  };
  registerProjectUpdateRoutes(server, {
    service,
    resolveProjectRootAsync: (projectId) =>
      Promise.resolve(projectId === 'project-one' ? ROOT : undefined),
  });
  servers.push(server);
  return server;
}
