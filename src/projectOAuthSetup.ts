import type { AppManifest } from '@ankhorage/contracts';
import type { AuthOAuthProviderId, AuthOAuthSetupPlan } from '@ankhorage/contracts/auth';
import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  APP_DEPLOY_TARGET_IDS,
  type AppDeployEnvironmentId,
  type AppDeployTargetId,
} from '@ankhorage/contracts/deploy';
import { resolveSupabaseOAuthSetupPlan } from '@ankhorage/supabase-auth';
import { readOwnProperty } from '@ankhorage/utility/object';

/***
 * Resolve a requested deploy environment to a canonical environment id with local fallback.
 * @todo Move this reusable deploy-contract resolver to @ankhorage/contracts/deploy or the deploy owner.
 */
export function resolveProjectAuthEnvironment(value: string | undefined): AppDeployEnvironmentId {
  return APP_DEPLOY_ENVIRONMENT_IDS.find((environment) => environment === value) ?? 'local';
}

/***
 * Read the enabled canonical deploy targets from a project manifest and reject missing generation state.
 * @todo Move project deploy-target resolution under src/deploy/ and expose any reusable contracts primitive from its owner.
 */
export function resolveProjectEnabledTargets(manifest: AppManifest): readonly AppDeployTargetId[] {
  const targets = manifest.deploy?.targets;
  if (!targets) {
    throw new Error(
      `Project '${manifest.metadata.slug}' is missing canonical deploy.targets generation state.`,
    );
  }

  return APP_DEPLOY_TARGET_IDS.filter(
    (target) => readOwnProperty<{ readonly enabled?: boolean }>(targets, target)?.enabled === true,
  );
}

/***
 * Resolve the Supabase OAuth setup plan for a project's enabled targets and selected environment.
 * @todo Move OAuth setup orchestration under src/auth/ while deploy target resolution stays with src/deploy/.
 */
export function resolveProjectOAuthSetupPlan(input: {
  readonly manifest: AppManifest;
  readonly provider: AuthOAuthProviderId;
  readonly environment: AppDeployEnvironmentId;
}): AuthOAuthSetupPlan | null {
  return resolveSupabaseOAuthSetupPlan({
    provider: input.provider,
    transport: 'brokeredRedirect',
    environment: input.environment,
    targets: resolveProjectEnabledTargets(input.manifest),
  });
}
