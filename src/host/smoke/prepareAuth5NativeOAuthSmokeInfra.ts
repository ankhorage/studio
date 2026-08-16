import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';

import { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';
import { upProjectInfrastructure } from '../orchestrator/studioInfraUp';
import { ProjectSecretService } from '../secrets/projectSecretService';
import type { TrustedOAuthSecretResolver } from '../secrets/trustedOAuthInfraEnvironment';
import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig';
import { createAuth5NativeOAuthSmokeManifest } from './createAuth5NativeOAuthSmokeManifest';

const GOOGLE_PROVIDER_ID = 'google';
const PUBLIC_ANON_KEY = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
const PUBLIC_SUPABASE_URL = 'EXPO_PUBLIC_SUPABASE_URL';

export interface PrepareAuth5NativeOAuthSmokeInfraArgs {
  readonly credentialsProjectId: string;
  readonly smokeWorkspaceRoot: string;
  readonly sourceWorkspaceRoot: string;
}

export interface PrepareAuth5NativeOAuthSmokeInfraResult {
  readonly androidCallback: string;
  readonly gatewayUrl: string;
  readonly iosCallback: string;
  readonly projectId: string;
  readonly target: string;
}

interface SmokeInfraActivation {
  readonly target: string;
}

export interface Auth5NativeOAuthSmokeInfraDependencies {
  activateSmokeInfrastructure(
    secretResolver: TrustedOAuthSecretResolver,
  ): Promise<SmokeInfraActivation>;
  readSmokePublicEnv(): Promise<string>;
  readSourceManifest(): Promise<AppManifest>;
  resolveSourceCredential(ref: string): Promise<SecretStoreResult<SecretPayload>>;
}

export async function prepareAuth5NativeOAuthSmokeInfra(
  args: PrepareAuth5NativeOAuthSmokeInfraArgs,
  dependencies: Auth5NativeOAuthSmokeInfraDependencies = createDependencies(args),
): Promise<PrepareAuth5NativeOAuthSmokeInfraResult> {
  const sourceManifest = await dependencies.readSourceManifest();
  const sourceCredentialRef = resolveGoogleCredentialRef(sourceManifest);
  const credential = await dependencies.resolveSourceCredential(sourceCredentialRef);
  if (!credential.ok) {
    throw new Error(
      `Unable to resolve trusted Google OAuth credentials from project '${args.credentialsProjectId}': ${credential.error.message}`,
    );
  }

  const smokeManifest = createAuth5NativeOAuthSmokeManifest();
  const smokeCredentialRef = resolveGoogleCredentialRef(smokeManifest);
  const callbackRoute = resolveOAuthCallbackRoute(smokeManifest);
  const activation = await dependencies.activateSmokeInfrastructure({
    resolve: ({ projectId, ref }) => {
      if (projectId !== AUTH5_NATIVE_OAUTH_SMOKE.projectId || ref !== smokeCredentialRef) {
        throw new Error(`Unexpected Auth 5 smoke OAuth secret request '${projectId}:${ref}'.`);
      }
      return Promise.resolve(credential);
    },
  });

  const smokePublicEnv = await dependencies.readSmokePublicEnv();
  const gatewayUrl = parseRequiredEnvValue(smokePublicEnv, PUBLIC_SUPABASE_URL);
  parseRequiredEnvValue(smokePublicEnv, PUBLIC_ANON_KEY);

  return {
    androidCallback: `${AUTH5_NATIVE_OAUTH_SMOKE.android.scheme}://${callbackRoute}`,
    gatewayUrl,
    iosCallback: `${AUTH5_NATIVE_OAUTH_SMOKE.ios.scheme}://${callbackRoute}`,
    projectId: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
    target: activation.target,
  };
}

function createDependencies(
  args: PrepareAuth5NativeOAuthSmokeInfraArgs,
): Auth5NativeOAuthSmokeInfraDependencies {
  const sourceProjectManager = new ProjectManager(args.sourceWorkspaceRoot);
  const smokeProjectManager = new ProjectManager(args.smokeWorkspaceRoot);
  const sourceSecretService = new ProjectSecretService({
    projectManager: sourceProjectManager,
    workspaceRoot: args.sourceWorkspaceRoot,
  });
  const smokeProjectPath = getProjectPath(
    args.smokeWorkspaceRoot,
    AUTH5_NATIVE_OAUTH_SMOKE.projectId,
  );

  return {
    readSmokePublicEnv: () => readFile(path.join(smokeProjectPath, '.env.local'), 'utf8'),
    readSourceManifest: () => sourceProjectManager.getProjectManifest(args.credentialsProjectId),
    resolveSourceCredential: (ref) =>
      sourceSecretService.resolve({ projectId: args.credentialsProjectId, ref }),
    activateSmokeInfrastructure: async (secretResolver) => {
      const result = await upProjectInfrastructure({
        projectId: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
        projectManager: smokeProjectManager,
        workspaceRoot: args.smokeWorkspaceRoot,
        secretResolver,
      });
      if (result.trustedOAuth.deferred) {
        throw new Error(result.trustedOAuth.reason);
      }
      if (!result.target) {
        throw new Error('Auth 5 smoke infrastructure did not resolve a target.');
      }
      return { target: result.target };
    },
  };
}

function resolveGoogleCredentialRef(manifest: AppManifest): string {
  const provider = manifest.infra.auth?.oauth?.providers.find(
    (candidate) => candidate.id === GOOGLE_PROVIDER_ID && candidate.enabled !== false,
  );
  const ref = provider?.credentialsRef?.trim();
  if (!ref) {
    throw new Error(
      'Configured source project must expose an enabled Google OAuth credentialsRef.',
    );
  }
  return ref;
}

function resolveOAuthCallbackRoute(manifest: AppManifest): string {
  const callbackRoute = manifest.infra.auth?.oauth?.callbackRoute.trim();
  if (!callbackRoute) {
    throw new Error('Auth 5 smoke manifest must expose a canonical OAuth callbackRoute.');
  }
  return callbackRoute.replace(/^\/+|\/+$/gu, '');
}

function parseRequiredEnvValue(raw: string, key: string): string {
  for (const line of raw.split(/\r?\n/u)) {
    const normalized = line.trim().replace(/^export\s+/u, '');
    if (!normalized || normalized.startsWith('#')) continue;
    const separator = normalized.indexOf('=');
    if (separator < 1 || normalized.slice(0, separator).trim() !== key) continue;
    const value = stripMatchingQuotes(normalized.slice(separator + 1).trim());
    if (value.length > 0) return value;
  }
  throw new Error(`Auth 5 smoke project is missing ${key} in .env.local after Infra Up.`);
}

function stripMatchingQuotes(value: string): string {
  if (value.length < 2) return value;
  const [first] = value;
  const last = value[value.length - 1];
  return (first === '"' && last === '"') || (first === "'" && last === "'")
    ? value.slice(1, -1)
    : value;
}
