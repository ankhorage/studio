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

export interface InfraSessionDependencies {
  readonly ensureProjectInfrastructureRuntime: typeof ensureProjectInfrastructureRuntime;
  readonly resolveProjectInfrastructurePortForward: typeof resolveProjectInfrastructurePortForward;
  readonly runProjectInfrastructureLifecycle: typeof runProjectInfrastructureLifecycle;
}

const defaultDependencies: InfraSessionDependencies = {
  ensureProjectInfrastructureRuntime,
  resolveProjectInfrastructurePortForward,
  runProjectInfrastructureLifecycle,
};

/***
 * Ensure one generated project's Infrastructure runtime session is available and remember it for shutdown cleanup.
 * @todo Move Studio Infrastructure-session orchestration out of generic `host/orchestrator` into the owning projects/infra host edge.
 */
export async function ensureProjectInfrastructureRuntimeSession(
  args: PortForwardSession,
  dependencies: InfraSessionDependencies = defaultDependencies,
): Promise<void> {
  try {
    await dependencies.ensureProjectInfrastructureRuntime(args);
  } catch (error) {
    throw withInfrastructureUpGuidance(error, args.projectId);
  }

  portForwardSessions.set(sessionKey(args), args);
}

/***
 * Resolve and ensure the web port-forward session required to launch a generated project.
 * @todo Keep this Studio launch-session use case with project/infra application ownership rather than generic orchestration.
 */
export async function ensureProjectWebLaunchSession(
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

  await ensureProjectInfrastructureRuntimeSession(args, dependencies);

  return { started, url: endpoint.url };
}

/***
 * Stop every remembered project Infrastructure port-forward while tolerating stale external sessions during shutdown.
 * @todo Move global Studio Infrastructure shutdown coordination to the project/infra application edge.
 */
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

/***
 * Build a stable compound key from project path, project id, and target.
 * @utility @ankhorage/utility/string
 */
function sessionKey(args: PortForwardSession): string {
  return `${args.projectPath}:${args.projectId}:${args.target}`;
}

/*** Preserve Infrastructure script diagnostics while appending the Studio-specific regeneration guidance. */
function withInfrastructureUpGuidance(error: unknown, projectId: string): Error {
  const guidance = `Run Infrastructure Up to regenerate project '${projectId}' infrastructure before retrying.`;
  if (error instanceof InfraScriptExecutionError) {
    const guidedError = new InfraScriptExecutionError({
      exitCode: error.exitCode,
      message: `${error.message} ${guidance}`,
      stderr: error.stderr,
      stdout: error.stdout,
    });
    guidedError.cause = error;
    return guidedError;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message} ${guidance}`, { cause: error });
}
