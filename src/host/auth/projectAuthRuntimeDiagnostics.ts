import type { AuthRedirectEnvironment } from '@ankhorage/infra';
import { resolveAuthRedirectConfiguration } from '@ankhorage/infra';
import {
  readProjectInfrastructureEnvironment,
  runProjectInfrastructureLifecycle,
} from '@ankhorage/infra/project';
import { readSafeRegexCapture, splitCommaSeparated } from '@ankhorage/utility/string';
import { isExactHttpUrl, resolveHttpOrigin } from '@ankhorage/utility/url';

import type { ProjectAuthDiagnostic } from '../../projectAuthHealth';
import type {
  ProjectAuthRuntimeDiagnostics,
  ProjectAuthRuntimeRolloutStatus,
} from '../../projectAuthRuntimeDiagnostics';
import { getProjectPath } from '../orchestrator/projectPaths';

const SAFE_INFRA_ENV_KEYS = [
  'API_EXTERNAL_URL',
  'APP_PORT_FORWARD_LOCAL_PORT',
  'EXPO_PUBLIC_SUPABASE_URL',
  'OAUTH_NATIVE_REDIRECT_URLS',
  'SITE_URL',
  'SUPABASE_GATEWAY_FORWARD_LOCAL_PORT',
] as const;

export interface ProjectAuthRedirectRuntime {
  readonly providerRedirectUrl: string;
  readonly siteUrl: string;
  readonly appCallbackTargets: readonly string[];
  readonly redirectAllowList: readonly string[];
}

export interface ParsedProjectAuthRuntimeStatus {
  readonly rolloutStatus: ProjectAuthRuntimeRolloutStatus;
  readonly providerRedirectUrl?: string;
  readonly appCallbackUrl?: string;
}

/***
 * Observe generated Auth redirect configuration and runtime lifecycle status for one Studio project.
 * @todo Keep this generated-infra observation under the auth domain's host adapter.
 */
export async function observeProjectAuthRuntimeDiagnostics(input: {
  readonly rootPath: string;
  readonly projectId: string;
  readonly target: string | null;
  readonly generated: boolean;
  readonly environment: AuthRedirectEnvironment;
  readonly callbackRoute: string;
}): Promise<ProjectAuthRuntimeDiagnostics> {
  if (!input.generated || !input.target) {
    return {
      appCallbackTargets: [],
      redirectAllowList: [],
      rolloutStatus: 'not-generated',
    };
  }

  const diagnostics: ProjectAuthDiagnostic[] = [];
  const projectPath = getProjectPath(input.rootPath, input.projectId);
  let expected: ProjectAuthRedirectRuntime | null = null;

  try {
    const environment = await readProjectInfrastructureEnvironment({
      keys: SAFE_INFRA_ENV_KEYS,
      projectPath,
      target: input.target,
    });
    expected = resolveProjectAuthRedirectRuntime({
      environment: input.environment,
      callbackRoute: input.callbackRoute,
      infraEnvironment: environment,
    });
  } catch {
    diagnostics.push({
      code: 'auth_redirect_configuration_unavailable',
      severity: 'warning',
      message: 'Canonical Auth callback diagnostics could not be derived from generated Infra.',
      path: 'infra.auth.oauth',
    });
  }

  let observed: ParsedProjectAuthRuntimeStatus = { rolloutStatus: 'unavailable' };
  try {
    const status = await runProjectInfrastructureLifecycle({
      projectId: input.projectId,
      projectPath,
      target: input.target,
      script: 'status',
    });
    observed = parseProjectAuthRuntimeStatus(status.stdout);
  } catch {
    // The public health result deliberately reports only a bounded state, never script output.
  }

  if (
    expected?.providerRedirectUrl &&
    observed.providerRedirectUrl &&
    expected.providerRedirectUrl !== observed.providerRedirectUrl
  ) {
    diagnostics.push({
      code: 'auth_runtime_provider_callback_stale',
      severity: 'error',
      message: 'The running Auth provider callback does not match generated Infra configuration.',
      path: 'infra.auth.oauth.providerCallback',
    });
  }

  const expectedAppCallbackUrl = expected?.appCallbackTargets.find(isExactHttpUrl);
  if (
    expectedAppCallbackUrl &&
    observed.appCallbackUrl &&
    expectedAppCallbackUrl !== observed.appCallbackUrl
  ) {
    diagnostics.push({
      code: 'auth_runtime_app_callback_stale',
      severity: 'error',
      message: 'The running Auth app callback does not match generated Infra configuration.',
      path: 'infra.auth.oauth.callbackRoute',
    });
  }

  return {
    ...(expected?.providerRedirectUrl
      ? { providerRedirectUrl: expected.providerRedirectUrl }
      : observed.providerRedirectUrl
        ? { providerRedirectUrl: observed.providerRedirectUrl }
        : {}),
    appCallbackTargets: expected?.appCallbackTargets ?? [],
    redirectAllowList: expected?.redirectAllowList ?? [],
    rolloutStatus: observed.rolloutStatus,
    diagnostics,
  };
}

/*** Resolve canonical Auth provider/site/callback URLs from generated infrastructure environment values. */
export function resolveProjectAuthRedirectRuntime(input: {
  readonly environment: AuthRedirectEnvironment;
  readonly callbackRoute: string;
  readonly infraEnvironment: Readonly<Record<string, string | undefined>>;
}): ProjectAuthRedirectRuntime {
  const siteOrigin = resolveHttpOrigin(
    input.infraEnvironment.SITE_URL,
    input.infraEnvironment.APP_PORT_FORWARD_LOCAL_PORT,
  );
  const gatewayOrigin = resolveHttpOrigin(
    input.infraEnvironment.API_EXTERNAL_URL ?? input.infraEnvironment.EXPO_PUBLIC_SUPABASE_URL,
    input.infraEnvironment.SUPABASE_GATEWAY_FORWARD_LOCAL_PORT,
  );

  if (!siteOrigin || !gatewayOrigin) {
    throw new Error('Generated Infra does not expose canonical app and gateway origins.');
  }

  const configuration = resolveAuthRedirectConfiguration({
    environment: input.environment,
    gatewayOrigin,
    siteOrigin,
    callbackRoute: input.callbackRoute,
    webOrigins: [siteOrigin],
    nativeRedirectUris: splitCommaSeparated(input.infraEnvironment.OAUTH_NATIVE_REDIRECT_URLS),
  });

  return {
    providerRedirectUrl: configuration.providerCallbackUrl,
    siteUrl: configuration.siteUrl,
    appCallbackTargets: configuration.redirectAllowList.filter(
      (target) => target !== configuration.siteUrl,
    ),
    redirectAllowList: configuration.redirectAllowList,
  };
}

/*** Parse bounded Auth provider callback and readiness values from generated infrastructure status output. */
export function parseProjectAuthRuntimeStatus(stdout: string): ParsedProjectAuthRuntimeStatus {
  const providerRedirectUrl = readSafeRegexCapture(
    stdout,
    /provider\s+supabase-auth\/provider-callback:\s*([^\r\n]+)/iu,
    { allowWhitespace: false, maxLength: 2048 },
  );
  const appCallbackUrl = readSafeRegexCapture(
    stdout,
    /provider\s+supabase-auth\/app-callback:\s*([^\r\n]+)/iu,
    { allowWhitespace: false, maxLength: 2048 },
  );
  const readiness = /provider\s+supabase-auth\/GoTrue:\s*(not ready|ready)\b/iu.exec(stdout)?.[1];

  return {
    rolloutStatus:
      readiness === 'ready' ? 'ready' : readiness === 'not ready' ? 'not-ready' : 'unavailable',
    ...(providerRedirectUrl ? { providerRedirectUrl } : {}),
    ...(appCallbackUrl ? { appCallbackUrl } : {}),
  };
}
