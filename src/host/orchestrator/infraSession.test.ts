import { InfraScriptExecutionError } from '@ankhorage/infra/project';
import { describe, expect, test } from 'bun:test';

import {
  ensureProjectInfrastructureRuntimeSession,
  ensureProjectWebLaunchSession,
  type InfraSessionDependencies,
} from './infraSession';

const session = {
  projectId: 'project-one',
  projectPath: '/workspace/apps/project-one',
  target: 'minikube',
} as const;

describe('Studio infrastructure runtime session', () => {
  test('ensures the topology-agnostic runtime without touching app-forward APIs', async () => {
    let ensureRuntimeCalls = 0;

    const result = await ensureProjectInfrastructureRuntimeSession(session, {
      resolveProjectInfrastructurePortForward: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      runProjectInfrastructureLifecycle: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      ensureProjectInfrastructureRuntime: () => {
        ensureRuntimeCalls += 1;
        return Promise.resolve({ stdout: '', stderr: '' });
      },
    });

    expect(result).toBeUndefined();
    expect(ensureRuntimeCalls).toBe(1);
  });

  for (const scenario of [
    { status: 'app: running\n', started: false },
    { status: 'app: stopped\n', started: true },
  ] as const) {
    test(`launch reports started=${scenario.started} for ${scenario.status.trim()}`, async () => {
      const calls: string[] = [];

      const result = await ensureProjectWebLaunchSession(session, {
        resolveProjectInfrastructurePortForward: () => {
          calls.push('resolve-app-endpoint');
          return Promise.resolve({ localPort: 4173, url: 'http://127.0.0.1:4173' });
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

      expect(calls).toEqual(['resolve-app-endpoint', 'read-app-status', 'ensure-runtime']);
      expect(result).toEqual({
        started: scenario.started,
        url: 'http://127.0.0.1:4173',
      });
    });
  }

  test('preserves Infra failure details and adds regeneration guidance once', async () => {
    const failure = new InfraScriptExecutionError({
      exitCode: 1,
      message:
        "Failed to ensure infrastructure runtime for project 'project-one': unknown group runtime",
      stderr: 'unknown group runtime',
      stdout: 'runtime output',
    });
    const dependencies: InfraSessionDependencies = {
      resolveProjectInfrastructurePortForward: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      runProjectInfrastructureLifecycle: () => {
        throw new Error('MUST NOT BE CALLED');
      },
      ensureProjectInfrastructureRuntime: () => Promise.reject(failure),
    };

    let rejected: unknown;
    try {
      await ensureProjectInfrastructureRuntimeSession(session, dependencies);
    } catch (error) {
      rejected = error;
    }

    expect(rejected).toBeInstanceOf(InfraScriptExecutionError);
    if (!(rejected instanceof InfraScriptExecutionError)) {
      throw new Error('Expected InfraScriptExecutionError.');
    }
    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr).toBe('unknown group runtime');
    expect(rejected.stdout).toBe('runtime output');
    expect(rejected.cause).toBe(failure);
    const guidance =
      "Run Infrastructure Up to regenerate project 'project-one' infrastructure before retrying.";
    expect(rejected.message).toContain(failure.message);
    expect(rejected.message.split(guidance)).toHaveLength(2);
  });
});
