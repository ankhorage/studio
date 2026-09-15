import {
  resolveTrustedOAuthInfraEnvironmentForUp,
  type TrustedOAuthSecretResolver,
} from '../secrets/trustedOAuthInfraEnvironment';
import type { ProjectManager } from './projectManager';

type StudioInfraProjectManager = Pick<
  ProjectManager,
  'getProjectManifest' | 'regenerateInfrastructure' | 'upInfrastructure'
>;

export interface StudioInfraUpResult {
  readonly runtime: string;
  readonly regenerated: Awaited<ReturnType<ProjectManager['regenerateInfrastructure']>>;
  readonly reconciled: Awaited<ReturnType<ProjectManager['upInfrastructure']>>;
  readonly trustedOAuth:
    { readonly deferred: false } | { readonly deferred: true; readonly reason: string };
}

/***
 * Regenerate and reconcile one project's local infrastructure through the provider-neutral Infra lifecycle.
 * @todo Move this Studio Infrastructure-up use case from generic `host/orchestrator` into the projects/infra application edge.
 */
export async function upProjectInfrastructure(args: {
  readonly projectId: string;
  readonly projectManager: StudioInfraProjectManager;
  readonly workspaceRoot: string;
  readonly secretResolver?: TrustedOAuthSecretResolver;
}): Promise<StudioInfraUpResult> {
  const regenerated = await args.projectManager.regenerateInfrastructure(args.projectId);
  const manifest = await args.projectManager.getProjectManifest(args.projectId);
  const trustedOAuth = await resolveTrustedOAuthInfraEnvironmentForUp({
    projectId: args.projectId,
    projectManager: args.projectManager,
    workspaceRoot: args.workspaceRoot,
    ...(args.secretResolver ? { secretResolver: args.secretResolver } : {}),
  });
  const reconciled = await args.projectManager.upInfrastructure(args.projectId, {
    ...process.env,
    ...trustedOAuth.env,
  });

  return {
    runtime: manifest.infra.environments.local.deployment.runtime.provider,
    regenerated,
    reconciled,
    trustedOAuth: trustedOAuth.deferred
      ? { deferred: true, reason: trustedOAuth.reason }
      : { deferred: false },
  };
}
