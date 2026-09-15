import type { InfraOutput, InfraStatus } from '@ankhorage/contracts/infra';

import type { ProjectAuthRuntimeDiagnostics } from '../../projectAuthRuntimeDiagnostics';

export interface ProjectAuthRedirectRuntime {
  readonly providerRedirectUrl: string;
  readonly appCallbackTargets: readonly string[];
  readonly redirectAllowList: readonly string[];
}

/*** Observe Auth redirect configuration and rollout readiness from provider-neutral Infra outputs and status. */
export async function observeProjectAuthRuntimeDiagnostics(input: {
  readonly callbackRoute: string;
  readonly outputs: readonly InfraOutput[];
  readonly publicBaseUrl?: string;
  readonly status: InfraStatus;
}): Promise<ProjectAuthRuntimeDiagnostics> {
  const expected = resolveProjectAuthRedirectRuntime({
    callbackRoute: input.callbackRoute,
    outputs: input.outputs,
    ...(input.publicBaseUrl ? { publicBaseUrl: input.publicBaseUrl } : {}),
  });

  return {
    providerRedirectUrl: expected.providerRedirectUrl,
    appCallbackTargets: expected.appCallbackTargets,
    redirectAllowList: expected.redirectAllowList,
    rolloutStatus: resolveProjectAuthRolloutStatus(input.status),
  };
}

/*** Resolve canonical Auth callback URLs from current public Infra outputs and authored networking intent. */
export function resolveProjectAuthRedirectRuntime(input: {
  readonly callbackRoute: string;
  readonly outputs: readonly InfraOutput[];
  readonly publicBaseUrl?: string;
}): ProjectAuthRedirectRuntime {
  const supabaseUrl = readPublicEnvironmentOutput(input.outputs, 'EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('Infra does not expose EXPO_PUBLIC_SUPABASE_URL for Auth diagnostics.');
  }

  const providerRedirectUrl = new URL('/auth/v1/callback', ensureTrailingSlash(supabaseUrl)).toString();
  const publicBaseUrl = input.publicBaseUrl?.trim();
  if (!publicBaseUrl) {
    return { providerRedirectUrl, appCallbackTargets: [], redirectAllowList: [] };
  }

  const siteUrl = ensureTrailingSlash(publicBaseUrl);
  const appCallbackUrl = new URL(normalizeCallbackRoute(input.callbackRoute), siteUrl).toString();
  return {
    providerRedirectUrl,
    appCallbackTargets: [appCallbackUrl],
    redirectAllowList: [siteUrl, appCallbackUrl],
  };
}

/*** Map provider-neutral Infra status to the bounded Auth rollout state exposed by Studio. */
function resolveProjectAuthRolloutStatus(
  status: InfraStatus,
): ProjectAuthRuntimeDiagnostics['rolloutStatus'] {
  if (status.state === 'ready') return 'ready';
  if (status.state === 'absent') return 'not-generated';
  if (
    status.state === 'pending' ||
    status.state === 'degraded' ||
    status.state === 'failed' ||
    status.state === 'stopped'
  ) {
    return 'not-ready';
  }
  return 'unavailable';
}

/*** Read one non-empty public Infra output by its application environment-variable name. */
function readPublicEnvironmentOutput(
  outputs: readonly InfraOutput[],
  environmentVariable: string,
): string | undefined {
  const output = outputs.find(
    (candidate) =>
      candidate.visibility === 'public' && candidate.environmentVariable === environmentVariable,
  );
  if (!output || output.visibility !== 'public') return undefined;
  const value = String(output.value).trim();
  return value.length > 0 ? value : undefined;
}

/*** Normalize an HTTP base URL to a trailing-slash form compatible with URL resolution. */
function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

/*** Normalize one authored callback route to a relative URL path. */
function normalizeCallbackRoute(value: string): string {
  return value.trim().replace(/^\/+/, '');
}
