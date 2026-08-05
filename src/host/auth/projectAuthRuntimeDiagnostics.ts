import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AuthRedirectEnvironment } from '@ankhorage/infra';
import { resolveAuthRedirectConfiguration } from '@ankhorage/infra';

import type { ProjectAuthDiagnostic } from '../../projectAuthHealth';
import type {
  ProjectAuthRuntimeDiagnostics,
  ProjectAuthRuntimeRolloutStatus,
} from '../../projectAuthRuntimeDiagnostics';
import { runProjectInfraScriptCapture } from '../orchestrator/infraRuntime';
import { getProjectPath } from '../orchestrator/projectPaths';

const SAFE_INFRA_ENV_KEYS = new Set([
  'API_EXTERNAL_URL',
  'APP_PORT_FORWARD_LOCAL_PORT',
  'EXPO_PUBLIC_SUPABASE_URL',
  'OAUTH_NATIVE_REDIRECT_URLS',
  'SITE_URL',
  'SUPABASE_GATEWAY_FORWARD_LOCAL_PORT',
]);

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
  let expected: ProjectAuthRedirectRuntime | null = null;

  try {
    const environment = await readSafeGeneratedInfraEnvironment({
      rootPath: input.rootPath,
      projectId: input.projectId,
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
    const status = await runProjectInfraScriptCapture({
      rootPath: input.rootPath,
      projectId: input.projectId,
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

  const expectedAppCallbackUrl = expected?.appCallbackTargets.find(isExactWebCallbackUrl);
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

export function resolveProjectAuthRedirectRuntime(input: {
  readonly environment: AuthRedirectEnvironment;
  readonly callbackRoute: string;
  readonly infraEnvironment: Readonly<Record<string, string | undefined>>;
}): ProjectAuthRedirectRuntime {
  const siteOrigin = resolveOrigin(
    input.infraEnvironment.SITE_URL,
    input.infraEnvironment.APP_PORT_FORWARD_LOCAL_PORT,
  );
  const gatewayOrigin = resolveOrigin(
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

export function parseProjectAuthRuntimeStatus(stdout: string): ParsedProjectAuthRuntimeStatus {
  const providerRedirectUrl = readSafeStatusValue(
    stdout,
    /provider\s+supabase-auth\/provider-callback:\s*([^\r\n]+)/iu,
  );
  const appCallbackUrl = readSafeStatusValue(
    stdout,
    /provider\s+supabase-auth\/app-callback:\s*([^\r\n]+)/iu,
  );
  const readiness = /provider\s+supabase-auth\/GoTrue:\s*(not ready|ready)\b/iu.exec(stdout)?.[1];

  return {
    rolloutStatus:
      readiness === 'ready' ? 'ready' : readiness === 'not ready' ? 'not-ready' : 'unavailable',
    ...(providerRedirectUrl ? { providerRedirectUrl } : {}),
    ...(appCallbackUrl ? { appCallbackUrl } : {}),
  };
}

async function readSafeGeneratedInfraEnvironment(input: {
  readonly rootPath: string;
  readonly projectId: string;
  readonly target: string;
}): Promise<Readonly<Record<string, string>>> {
  const projectPath = getProjectPath(input.rootPath, input.projectId);
  const infraRoot = path.join(projectPath, 'infra', input.target);
  const envPath = path.join(infraRoot, '.env');
  const fallbackPath = path.join(infraRoot, '.env.example');
  const sourcePath = (await exists(envPath)) ? envPath : fallbackPath;
  const content = await fs.readFile(sourcePath, 'utf8');
  const environment: Record<string, string> = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!SAFE_INFRA_ENV_KEYS.has(key)) continue;
    environment[key] = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }

  return environment;
}

function resolveOrigin(value: string | undefined, portValue: string | undefined): string | null {
  if (value?.trim()) {
    try {
      return new URL(value.trim()).origin;
    } catch {
      return null;
    }
  }

  const port = parsePort(portValue);
  return port === null ? null : `http://127.0.0.1:${port}`;
}

function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function splitCommaSeparated(value: string | undefined): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readSafeStatusValue(stdout: string, pattern: RegExp): string | undefined {
  const value = pattern.exec(stdout)?.[1]?.trim();
  if (!value || value.length > 2048 || /\s/u.test(value)) return undefined;
  return value;
}

function isExactWebCallbackUrl(value: string): boolean {
  return /^https?:\/\//u.test(value) && !value.includes('*');
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
