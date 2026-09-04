import { runProjectInfrastructureLifecycle } from '@ankhorage/infra/project';

import {
  resolveTrustedOAuthInfraEnvironmentForUp,
  type TrustedOAuthSecretResolver,
} from '../secrets/trustedOAuthInfraEnvironment';
import { ensureProjectInfrastructureRuntimeSession } from './infraSession';
import type { ProjectManager } from './projectManager';
import { getProjectPath } from './projectPaths';

type StudioInfraProjectManager = Pick<
  ProjectManager,
  'getInfrastructureStatus' | 'getProjectManifest' | 'regenerateInfrastructure'
>;

interface StudioInfraUpDependencies {
  readonly ensureProjectInfrastructureRuntimeSession: typeof ensureProjectInfrastructureRuntimeSession;
  readonly runProjectInfrastructureLifecycle: typeof runProjectInfrastructureLifecycle;
}

const defaultDependencies: StudioInfraUpDependencies = {
  ensureProjectInfrastructureRuntimeSession,
  runProjectInfrastructureLifecycle,
};

export interface StudioInfraUpResult {
  readonly target?: string;
  readonly regenerated: Awaited<ReturnType<ProjectManager['regenerateInfrastructure']>>;
  readonly skipped?: Awaited<ReturnType<ProjectManager['regenerateInfrastructure']>>['skipped'];
  readonly trustedOAuth:
    | {
        readonly deferred: false;
      }
    | {
        readonly deferred: true;
        readonly reason: string;
      };
}

/***
 * Regenerate and start one project's Infrastructure, injecting trusted OAuth environment and ensuring the runtime session.
 * @todo Move this Studio Infrastructure-up use case from generic `host/orchestrator` into the projects/infra application edge.
 */
export async function upProjectInfrastructure(
  args: {
    readonly projectId: string;
    readonly projectManager: StudioInfraProjectManager;
    readonly workspaceRoot: string;
    readonly secretResolver?: TrustedOAuthSecretResolver;
  },
  dependencies: StudioInfraUpDependencies = defaultDependencies,
): Promise<StudioInfraUpResult> {
  const regenerated = await args.projectManager.regenerateInfrastructure(args.projectId);
  if (regenerated.skipped) {
    return {
      skipped: regenerated.skipped,
      regenerated,
      trustedOAuth: { deferred: false },
    };
  }

  const status = await args.projectManager.getInfrastructureStatus(args.projectId);
  if (!status.target) {
    throw new Error(
      `Project '${args.projectId}' has no infrastructure target. Run infra generation first.`,
    );
  }

  const trustedOAuth = await resolveTrustedOAuthInfraEnvironmentForUp({
    projectId: args.projectId,
    projectManager: args.projectManager,
    workspaceRoot: args.workspaceRoot,
    ...(args.secretResolver ? { secretResolver: args.secretResolver } : {}),
  });
  const projectPath = getProjectPath(args.workspaceRoot, args.projectId);

  await dependencies.runProjectInfrastructureLifecycle({
    projectId: args.projectId,
    projectPath,
    target: status.target,
    script: 'up',
    env: {
      ...process.env,
      ...trustedOAuth.env,
    },
  });
  await dependencies.ensureProjectInfrastructureRuntimeSession({
    projectId: args.projectId,
    projectPath,
    target: status.target,
  });

  return {
    target: status.target,
    regenerated,
    trustedOAuth: trustedOAuth.deferred
      ? { deferred: true, reason: trustedOAuth.reason }
      : { deferred: false },
  };
}
