import { InfraScriptExecutionError } from '@ankhorage/infra/project';
import { describe, expect, test } from 'bun:test';

import { ensureProjectInfrastructureRuntimeSession } from './infraSession';

const session = {
  projectId: 'project-one',
  projectPath: '/workspace/apps/project-one',
  target: 'minikube',
} as const;

describe('Studio infrastructure runtime session', () => {
  test('ensures the complete runtime when the app forward is already running', async () => {
    const calls: string[] = [];

    const result = await ensureProjectInfrastructureRuntimeSession(session, {
      resolveProjectInfrastructurePortForward: () => {
        calls.push('resolve-app-endpoint');
        return Promise.resolve({ localPort: 4173, url: 'http://127.0.0.1:4173' });
      },
      runProjectInfrastructureLifecycle: () => {
        calls.push('read-app-status');
        return Promise.resolve({ stdout: 'app: running\n', stderr: '' });
      },
      ensureProjectInfrastructureRuntime: () => {
        calls.push('ensure-runtime');
        return Promise.resolve({ stdout: '', stderr: '' });
      },
    });

    expect(calls).toEqual(['resolve-app-endpoint', 'read-app-status', 'ensure-runtime']);
    expect(result).toEqual({ started: false, url: 'http://127.0.0.1:4173' });
  });

  test('preserves Infra failure details and adds regeneration guidance', async () => {
    const failure = new InfraScriptExecutionError({
      exitCode: 1,
      message:
        "Failed to ensure infrastructure runtime for project 'project-one': unknown group runtime",
      stderr: 'unknown group runtime',
      stdout: '',
    });

    let rejected: unknown;
    try {
      await ensureProjectInfrastructureRuntimeSession(session, {
        resolveProjectInfrastructurePortForward: () =>
          Promise.resolve({ localPort: 4173, url: 'http://127.0.0.1:4173' }),
        runProjectInfrastructureLifecycle: () =>
          Promise.resolve({ stdout: 'app: stopped\n', stderr: '' }),
        ensureProjectInfrastructureRuntime: () => Promise.reject(failure),
      });
    } catch (error) {
      rejected = error;
    }

    expect(rejected).toBeInstanceOf(InfraScriptExecutionError);
    if (!(rejected instanceof InfraScriptExecutionError)) {
      throw new Error('Expected InfraScriptExecutionError.');
    }
    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr).toBe('unknown group runtime');
    expect(rejected.message).toContain(
      "Run Infrastructure Up to regenerate project 'project-one' infrastructure before launching it.",
    );
  });
});
