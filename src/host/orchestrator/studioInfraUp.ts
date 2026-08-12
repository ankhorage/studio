import { runProjectInfrastructureLifecycle } from '@ankhorage/infra/project';

import {
  resolveTrustedOAuthInfraEnvironmentForUp,
  type TrustedOAuthSecretResolver,
} from '../secrets/trustedOAuthInfraEnvironment';
import { registerProjectInfraPortForwardOwner } from './infraSession';
import type { ProjectManager } from './projectManager';
import { getProjectPath } from './projectPaths';

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

export async function upProjectInfrastructure(args: {
  readonly projectId: string;
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
  readonly secretResolver?: TrustedOAuthSecretResolver;
}): Promise<StudioInfraUpResult> {
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

  await runProjectInfrastructureLifecycle({
    projectId: args.projectId,
    projectPath,
    target: status.target,
    script: 'up',
    env: {
      ...process.env,
      ...trustedOAuth.env,
    },
  });
  await registerProjectInfraPortForwardOwner({
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
