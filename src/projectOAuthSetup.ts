import type { AppManifest } from '@ankhorage/contracts';
import type { AuthOAuthProviderId, AuthOAuthSetupPlan } from '@ankhorage/contracts/auth';
import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  APP_DEPLOY_TARGET_IDS,
  type AppDeployEnvironmentId,
  type AppDeployTargetId,
} from '@ankhorage/contracts/deploy';
import { resolveSupabaseOAuthSetupPlan } from '@ankhorage/supabase-auth';

import { readOwnProperty } from './utils/readOwnProperty';

export function resolveProjectAuthEnvironment(value: string | undefined): AppDeployEnvironmentId {
  return APP_DEPLOY_ENVIRONMENT_IDS.find((environment) => environment === value) ?? 'local';
}

export function resolveProjectEnabledTargets(manifest: AppManifest): readonly AppDeployTargetId[] {
  const targets = manifest.deploy?.targets;
  if (!targets) return ['web'];

  return APP_DEPLOY_TARGET_IDS.filter(
    (target) => readOwnProperty<{ readonly enabled?: boolean }>(targets, target)?.enabled === true,
  );
}

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
