import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { upProjectInfrastructure } from './studioInfraUp';

describe('Studio Infrastructure Up', () => {
  test('ensures the application runtime after successful Infra Up', async () => {
    const calls: unknown[][] = [];
    const regenerated = { generated: 5, removed: 0, warnings: [] } as const;
    const manifest = { infra: {} } as AppManifest;

    const result = await upProjectInfrastructure(
      {
        projectId: 'project-one',
        workspaceRoot: '/workspace',
        projectManager: {
          regenerateInfrastructure: (projectId) => {
            calls.push(['regenerate', projectId]);
            return Promise.resolve(regenerated);
          },
          getInfrastructureStatus: (projectId) => {
            calls.push(['status', projectId]);
            return Promise.resolve({
              generated: true,
              generatedAt: '2026-08-22T00:00:00.000Z',
              hasDeployment: true,
              target: 'minikube',
              trackedFiles: 5,
              warnings: [],
            });
          },
          getProjectManifest: (projectId) => {
            calls.push(['manifest', projectId]);
            return Promise.resolve(manifest);
          },
        },
      },
      {
        runProjectInfrastructureLifecycle: (args) => {
          calls.push(['up', args.projectId, args.projectPath, args.target, args.script]);
          return Promise.resolve({ stdout: '', stderr: '' });
        },
        ensureProjectInfrastructureRuntimeSession: (args) => {
          calls.push(['runtime', args]);
          return Promise.resolve();
        },
      },
    );

    expect(result).toEqual({
      target: 'minikube',
      regenerated,
      trustedOAuth: { deferred: false },
    });
    expect(calls).toEqual([
      ['regenerate', 'project-one'],
      ['status', 'project-one'],
      ['manifest', 'project-one'],
      ['up', 'project-one', '/workspace/apps/project-one', 'minikube', 'up'],
      [
        'runtime',
        {
          projectId: 'project-one',
          projectPath: '/workspace/apps/project-one',
          target: 'minikube',
        },
      ],
    ]);
  });
});
