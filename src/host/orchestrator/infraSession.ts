import {
  ensureProjectInfrastructureRuntime,
  InfraScriptExecutionError,
  resolveProjectInfrastructurePortForward,
  runProjectInfrastructureLifecycle,
} from '@ankhorage/infra/project';

interface PortForwardSession {
  readonly projectId: string;
  readonly projectPath: string;
  readonly target: string;
}

const portForwardSessions = new Map<string, PortForwardSession>();

interface InfraSessionDependencies {
  readonly ensureProjectInfrastructureRuntime: typeof ensureProjectInfrastructureRuntime;
  readonly resolveProjectInfrastructurePortForward: typeof resolveProjectInfrastructurePortForward;
  readonly runProjectInfrastructureLifecycle: typeof runProjectInfrastructureLifecycle;
}

const defaultDependencies: InfraSessionDependencies = {
  ensureProjectInfrastructureRuntime,
  resolveProjectInfrastructurePortForward,
  runProjectInfrastructureLifecycle,
};

export async function ensureProjectInfrastructureRuntimeSession(
  args: PortForwardSession,
  dependencies: InfraSessionDependencies = defaultDependencies,
): Promise<{
  readonly started: boolean;
  readonly url: string;
}> {
  const endpoint = await dependencies.resolveProjectInfrastructurePortForward(args);
  const status = await dependencies.runProjectInfrastructureLifecycle({
    ...args,
    script: 'port-forward',
    args: ['status', 'app'],
  });
  const started = !/\bapp:\s+running\b/u.test(status.stdout);

  try {
    await dependencies.ensureProjectInfrastructureRuntime(args);
  } catch (error) {
    throw withInfrastructureUpGuidance(error, args.projectId);
  }

  portForwardSessions.set(sessionKey(args), args);
  return { started, url: endpoint.url };
}

export async function stopAllProjectInfraPortForwards(): Promise<void> {
  const sessions = [...portForwardSessions.values()];
  portForwardSessions.clear();

  await Promise.all(
    sessions.map(async (session) => {
      try {
        await runProjectInfrastructureLifecycle({
          ...session,
          script: 'port-forward',
          args: ['stop', 'all'],
        });
      } catch {
        // Studio shutdown must not be blocked by a stale external runtime session.
      }
    }),
  );
}

function sessionKey(args: PortForwardSession): string {
  return `${args.projectPath}:${args.projectId}:${args.target}`;
}

function withInfrastructureUpGuidance(error: unknown, projectId: string): Error {
  const guidance = `Run Infrastructure Up to regenerate project '${projectId}' infrastructure before launching it.`;
  if (error instanceof InfraScriptExecutionError) {
    return new InfraScriptExecutionError({
      exitCode: error.exitCode,
      message: `${error.message} ${guidance}`,
      stderr: error.stderr,
      stdout: error.stdout,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message} ${guidance}`, { cause: error });
}
