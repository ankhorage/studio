import {
  resolveProjectInfrastructurePortForward,
  runProjectInfrastructureLifecycle,
} from '@ankhorage/infra/project';

interface PortForwardSession {
  readonly projectId: string;
  readonly projectPath: string;
  readonly target: string;
}

const portForwardSessions = new Map<string, PortForwardSession>();

export async function ensureProjectInfraPortForward(args: PortForwardSession): Promise<{
  readonly started: boolean;
  readonly url: string;
}> {
  const endpoint = await resolveProjectInfrastructurePortForward(args);
  const status = await runProjectInfrastructureLifecycle({
    ...args,
    script: 'port-forward',
    args: ['status', 'app'],
  });
  const started = !/\bapp:\s+running\b/u.test(status.stdout);

  if (started) {
    await runProjectInfrastructureLifecycle({
      ...args,
      script: 'port-forward',
      args: ['start', 'app'],
    });
  }

  portForwardSessions.set(sessionKey(args), args);
  return { started, url: endpoint.url };
}

export async function registerProjectInfraPortForwardOwner(
  args: PortForwardSession,
): Promise<{ readonly url: string }> {
  const endpoint = await resolveProjectInfrastructurePortForward(args);
  portForwardSessions.set(sessionKey(args), args);
  return { url: endpoint.url };
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
