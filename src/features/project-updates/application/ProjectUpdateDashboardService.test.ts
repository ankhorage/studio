import { describe, expect, test } from 'bun:test';

import type { ProjectUpdateHostPort } from './ports/outbound/ProjectUpdateHostPort';
import { ProjectUpdateDashboardService } from './ProjectUpdateDashboardService';

describe('ProjectUpdateDashboardService', () => {
  test('routes the reviewed lifecycle only by selected project id and explicit permissions', async () => {
    const calls: unknown[] = [];
    const port = createHostPort(calls);
    const service = new ProjectUpdateDashboardService(port);
    const permissions = {
      ownerCode: true,
      lifecycleScripts: false,
      externalEffects: false,
    } as const;
    const plan = { operation: 'plan', id: 'plan-one' };

    await service.inspectAsync('project-one', 'refresh');
    await service.planAsync('project-one', 'offline');
    await service.applyAsync('project-one', plan, permissions);
    await service.resumeAsync('project-one', 'operation-one', permissions);
    await service.verifyAsync('project-one', 'operation-one');

    expect(calls).toEqual([
      { operation: 'status', projectId: 'project-one', availability: 'refresh' },
      {
        operation: 'plan',
        projectId: 'project-one',
        input: {
          availability: 'offline',
          policy: {
            dependencyUpdates: 'safe',
            repairInstallations: true,
            repairProjections: true,
          },
        },
      },
      { operation: 'apply', projectId: 'project-one', plan, permissions },
      { operation: 'resume', projectId: 'project-one', operationId: 'operation-one', permissions },
      { operation: 'verify', projectId: 'project-one', operationId: 'operation-one' },
    ]);
  });

  test('rejects missing project and operation identities before reaching the host adapter', () => {
    const calls: unknown[] = [];
    const service = new ProjectUpdateDashboardService(createHostPort(calls));

    expect(service.inspectAsync('  ', 'refresh')).rejects.toThrow(
      'A selected project is required.',
    );
    expect(
      service.resumeAsync('project-one', ' ', {
        ownerCode: false,
        lifecycleScripts: false,
        externalEffects: false,
      }),
    ).rejects.toThrow('An APM operation ID is required.');
    expect(calls).toEqual([]);
  });
});

function createHostPort(calls: unknown[]): ProjectUpdateHostPort {
  return {
    statusAsync: (projectId, availability) => {
      calls.push({ operation: 'status', projectId, availability });
      return Promise.resolve({ operation: 'status' });
    },
    planAsync: (projectId, input) => {
      calls.push({ operation: 'plan', projectId, input });
      return Promise.resolve({ operation: 'plan' });
    },
    applyAsync: (projectId, plan, permissions) => {
      calls.push({ operation: 'apply', projectId, plan, permissions });
      return Promise.resolve({ operation: 'apply', operationId: 'operation-one' });
    },
    resumeAsync: (projectId, operationId, permissions) => {
      calls.push({ operation: 'resume', projectId, operationId, permissions });
      return Promise.resolve({ operation: 'apply', operationId });
    },
    verifyAsync: (projectId, operationId) => {
      calls.push({ operation: 'verify', projectId, operationId });
      return Promise.resolve({ operation: 'verify', operationId });
    },
  };
}
