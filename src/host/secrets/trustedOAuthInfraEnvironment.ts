import type { AppManifest } from '@ankhorage/contracts';
import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';

import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from './projectSecretService';

export interface TrustedOAuthSecretResolver {
  resolve(input: {
    readonly projectId: string;
    readonly ref: string;
  }): Promise<SecretStoreResult<SecretPayload>>;
}

export async function resolveTrustedOAuthInfraEnvironment(args: {
  readonly projectId: string;
  readonly projectManager: Pick<ProjectManager, 'getStudioManifest' | 'getProjectManifest'>;
  readonly workspaceRoot: string;
  readonly secretResolver?: TrustedOAuthSecretResolver;
}): Promise<Record<string, string | undefined>> {
  const manifest = await readCurrentManifest(args.projectId, args.projectManager);
  const providers = manifest.infra.auth?.oauth?.enabled
    ? manifest.infra.auth.oauth.providers.filter((provider) => provider.enabled !== false)
    : [];
  if (providers.length === 0) return {};

  const secretResolver =
    args.secretResolver ??
    new ProjectSecretService({
      projectManager: args.projectManager as ProjectManager,
      workspaceRoot: args.workspaceRoot,
    });
  const env: Record<string, string | undefined> = {};

  for (const provider of providers) {
    if (!provider.credentialsRef) {
      throw new Error(`Enabled OAuth provider '${provider.id}' does not configure credentialsRef.`);
    }

    const result = await secretResolver.resolve({
      projectId: args.projectId,
      ref: provider.credentialsRef,
    });
    if (!result.ok) {
      throw new Error(
        `Failed to resolve trusted OAuth credentials for provider '${provider.id}' at '${provider.credentialsRef}': ${result.error.message}`,
      );
    }

    const { clientId, clientSecret } = result.data;
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
      throw new Error(
        `Trusted OAuth credentials for provider '${provider.id}' at '${provider.credentialsRef}' must include string clientId and clientSecret.`,
      );
    }

    const envPrefix = provider.id
      .toUpperCase()
      .replace(/[^A-Z0-9]+/gu, '_')
      .replace(/^_+|_+$/gu, '');
    if (!envPrefix) {
      throw new Error(`OAuth provider '${provider.id}' did not produce a valid GoTrue env prefix.`);
    }

    env[`GOTRUE_EXTERNAL_${envPrefix}_CLIENT_ID`] = clientId;
    env[`GOTRUE_EXTERNAL_${envPrefix}_SECRET`] = clientSecret;
  }

  return env;
}

async function readCurrentManifest(
  projectId: string,
  projectManager: Pick<ProjectManager, 'getStudioManifest' | 'getProjectManifest'>,
): Promise<AppManifest> {
  try {
    return await projectManager.getStudioManifest(projectId);
  } catch {
    return projectManager.getProjectManifest(projectId);
  }
}
