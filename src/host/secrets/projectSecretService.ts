import {
  type AppManifest,
  type AuthOAuthProviderConfig,
  type AuthOAuthProviderId,
  DEFAULT_AUTH_FLOW,
} from '@ankhorage/contracts';
import {
  normalizeSecretRef,
  type SecretCreateInput,
  type SecretListInput,
  type SecretMetadata,
  type SecretPayload,
  type SecretReplaceInput,
  type SecretStoreAdapter,
  type SecretStoreResult,
} from '@ankhorage/contracts/secrets';
import { createInfraSecretStoreAdapter } from '@ankhorage/infra';
import {
  getSupabaseOAuthProviderDefinition,
  validateSupabaseOAuthSecretPayload,
} from '@ankhorage/supabase-auth';

import { findProjectSecretUsages, type ProjectSecretUsageSummary } from '../../projectSecretUsage';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';
import {
  type BunSupabaseVaultClient,
  createBunSupabaseVaultClient,
} from './bunSupabaseVaultClient';
import { resolveProjectSecretDatabaseUrl } from './resolveProjectSecretDatabaseUrl';

export interface ProjectSecretServiceOptions {
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
  readonly createClient?: (databaseUrl: string) => BunSupabaseVaultClient;
  readonly resolveDatabaseUrl?: (projectPath: string) => Promise<string>;
}

export interface ConfigureOAuthProviderInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly providerId: AuthOAuthProviderId;
  readonly payload: SecretPayload;
  readonly credentialsRef?: string;
  readonly enabled?: boolean;
  readonly label?: string;
  readonly scopes?: readonly string[];
  readonly callbackRoute?: string;
}

export type ConfigureOAuthProviderResult =
  | {
      readonly ok: true;
      readonly state: 'saved';
      readonly metadata: SecretMetadata;
      readonly credentialsRef: string;
    }
  | {
      readonly ok: false;
      readonly state: 'secret_write_failed' | 'secret_saved_manifest_failed';
      readonly error: { readonly code: string; readonly message: string };
      readonly metadata?: SecretMetadata;
      readonly credentialsRef?: string;
    };

export type ProjectSecretRemoveResult =
  | {
      readonly ok: true;
      readonly data: ProjectSecretUsageSummary;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
      readonly data?: ProjectSecretUsageSummary;
    };

export class ProjectSecretService {
  private readonly projectManager: ProjectManager;
  private readonly workspaceRoot: string;
  private readonly createClient: (databaseUrl: string) => BunSupabaseVaultClient;
  private readonly resolveDatabaseUrl: (projectPath: string) => Promise<string>;

  constructor(options: ProjectSecretServiceOptions) {
    this.projectManager = options.projectManager;
    this.workspaceRoot = options.workspaceRoot;
    this.createClient = options.createClient ?? createBunSupabaseVaultClient;
    this.resolveDatabaseUrl =
      options.resolveDatabaseUrl ??
      ((projectPath) => resolveProjectSecretDatabaseUrl({ projectPath }));
  }

  list(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly kind?: string;
    readonly provider?: string;
  }): Promise<SecretStoreResult<readonly SecretMetadata[]>> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.list({
        scope: createScope(input.projectId, input.environment),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
      } satisfies SecretListInput),
    );
  }

  getMetadata(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
  }): Promise<SecretStoreResult<SecretMetadata>> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.getMetadata({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
      }),
    );
  }

  create(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
    readonly kind: string;
    readonly provider?: string;
    readonly payload: SecretPayload;
  }): Promise<SecretStoreResult<SecretMetadata>> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.create({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
        kind: input.kind,
        ...(input.provider ? { provider: input.provider } : {}),
        payload: input.payload,
      } satisfies SecretCreateInput),
    );
  }

  replace(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
    readonly payload: SecretPayload;
  }): Promise<SecretStoreResult<SecretMetadata>> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.replace({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
        payload: input.payload,
      } satisfies SecretReplaceInput),
    );
  }

  remove(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
  }): Promise<SecretStoreResult> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.remove({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
      }),
    );
  }

  async getUsages(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
  }): Promise<ProjectSecretUsageSummary> {
    const manifest = await this.readEditableManifest(input.projectId);
    return findProjectSecretUsages({ manifest, ref: input.ref });
  }

  async removeGuarded(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
    readonly confirmBrokenReferences?: boolean;
  }): Promise<ProjectSecretRemoveResult> {
    let client: BunSupabaseVaultClient | null = null;

    try {
      const manifest = await this.readEditableManifest(input.projectId);
      const projectPath = getProjectPath(this.workspaceRoot, input.projectId);
      const databaseUrl = await this.resolveDatabaseUrl(projectPath);
      client = this.createClient(databaseUrl);
      const adapter = createInfraSecretStoreAdapter({
        manifest: manifest.infra,
        providers: {
          supabaseVault: { client },
        },
      });

      if (!adapter) {
        return {
          ok: false,
          error: {
            code: 'invalid_config',
            message: 'This project does not configure infra.secretStore.provider.',
          },
        };
      }

      const usages = findProjectSecretUsages({ manifest, ref: input.ref });
      if (usages.usages.length > 0 && input.confirmBrokenReferences !== true) {
        return {
          ok: false,
          error: {
            code: 'secret_in_use',
            message: 'The secret is referenced by the current project configuration.',
          },
          data: usages,
        };
      }

      const removeResult = await adapter.remove({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
      });
      if (!removeResult.ok) return removeResult;

      return { ok: true, data: usages };
    } catch {
      return {
        ok: false,
        error: {
          code: 'unavailable',
          message:
            'The project secret store is unavailable. Verify local Supabase is running and the trusted database URL is configured.',
        },
      };
    } finally {
      await client?.close();
    }
  }

  async configureOAuthProvider(
    input: ConfigureOAuthProviderInput,
  ): Promise<ConfigureOAuthProviderResult> {
    const definition = getSupabaseOAuthProviderDefinition(input.providerId);
    if (!definition) {
      return {
        ok: false,
        state: 'secret_write_failed',
        error: {
          code: 'invalid_config',
          message: `OAuth provider "${input.providerId}" is not supported by the current Supabase provider registry.`,
        },
      };
    }

    const payloadResult = validateSupabaseOAuthSecretPayload(input.providerId, input.payload);
    if (!payloadResult.ok) {
      return {
        ok: false,
        state: 'secret_write_failed',
        error: toPublicError(payloadResult.error),
      };
    }

    const refResult = normalizeSecretRef(input.credentialsRef ?? `auth/oauth/${definition.id}`);
    if (!refResult.ok) {
      return {
        ok: false,
        state: 'secret_write_failed',
        error: toPublicError(refResult.error),
      };
    }

    const scope = createScope(input.projectId, input.environment);
    const secretResult = await this.withAdapter(input.projectId, async (adapter) => {
      const existing = await adapter.getMetadata({ scope, ref: refResult.data });
      if (existing.ok) {
        return adapter.replace({ scope, ref: refResult.data, payload: payloadResult.data });
      }
      if (existing.error.code !== 'not_found') return existing;

      return adapter.create({
        scope,
        ref: refResult.data,
        kind: 'oauth',
        provider: definition.id,
        payload: payloadResult.data,
      });
    });

    if (!secretResult.ok) {
      return {
        ok: false,
        state: 'secret_write_failed',
        error: toPublicError(secretResult.error),
      };
    }

    const manifest = await this.readEditableManifest(input.projectId);
    const nextManifest = configureManifestOAuthProvider(manifest, {
      provider: {
        id: definition.id,
        label: normalizeOptionalText(input.label) ?? definition.label,
        enabled: input.enabled ?? true,
        scopes: normalizeScopes(input.scopes ?? definition.defaultScopes),
        credentialsRef: refResult.data,
      },
      callbackRoute: input.callbackRoute,
    });

    try {
      await this.projectManager.saveStudioManifest({
        projectId: input.projectId,
        manifest: nextManifest,
      });
    } catch {
      return {
        ok: false,
        state: 'secret_saved_manifest_failed',
        metadata: secretResult.data,
        credentialsRef: refResult.data,
        error: {
          code: 'manifest_write_failed',
          message:
            'OAuth credentials were saved, but the manifest update failed. Retry the manifest save or remove the stored secret explicitly.',
        },
      };
    }

    return {
      ok: true,
      state: 'saved',
      metadata: secretResult.data,
      credentialsRef: refResult.data,
    };
  }

  private async readEditableManifest(projectId: string): Promise<AppManifest> {
    try {
      return await this.projectManager.getStudioManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
    }
  }

  private async withAdapter<TResult>(
    projectId: string,
    operation: (
      adapter: SecretStoreAdapter,
      manifest: AppManifest,
    ) => Promise<SecretStoreResult<TResult>>,
  ): Promise<SecretStoreResult<TResult>> {
    let client: BunSupabaseVaultClient | null = null;

    try {
      const manifest = await this.readEditableManifest(projectId);
      const projectPath = getProjectPath(this.workspaceRoot, projectId);
      const databaseUrl = await this.resolveDatabaseUrl(projectPath);
      client = this.createClient(databaseUrl);
      const adapter = createInfraSecretStoreAdapter({
        manifest: manifest.infra,
        providers: {
          supabaseVault: { client },
        },
      });

      if (!adapter) {
        return {
          ok: false,
          error: {
            code: 'invalid_config',
            message: 'This project does not configure infra.secretStore.provider.',
          },
        };
      }

      return await operation(adapter, manifest);
    } catch {
      return {
        ok: false,
        error: {
          code: 'unavailable',
          message:
            'The project secret store is unavailable. Verify local Supabase is running and the trusted database URL is configured.',
        },
      };
    } finally {
      await client?.close();
    }
  }
}

export function configureManifestOAuthProvider(
  manifest: AppManifest,
  input: {
    readonly provider: AuthOAuthProviderConfig;
    readonly callbackRoute?: string;
  },
): AppManifest {
  const currentAuth = manifest.infra.auth;
  const currentOAuth = currentAuth?.oauth;
  const existingCallbackRoute = currentOAuth ? currentOAuth.callbackRoute : undefined;
  const callbackRoute =
    normalizeOptionalText(input.callbackRoute) ??
    normalizeOptionalText(existingCallbackRoute) ??
    '/auth/callback';
  const providers = [...(currentOAuth?.providers ?? [])];
  const existingIndex = providers.findIndex((provider) => provider.id === input.provider.id);

  if (existingIndex >= 0) providers[existingIndex] = input.provider;
  else providers.push(input.provider);

  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      auth: {
        ...(currentAuth ?? {
          provider: 'supabase',
          scope: 'global',
          flow: { ...DEFAULT_AUTH_FLOW },
          signIn: { identifiers: ['email'] },
        }),
        oauth: {
          enabled: true,
          callbackRoute,
          providers,
        },
      },
    },
  };
}

function createScope(projectId: string, environment = 'local') {
  return {
    projectId,
    environment: normalizeOptionalText(environment) ?? 'local',
  };
}

function normalizeScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized;
}

function toPublicError(error: { readonly code: string; readonly message: string }) {
  return { code: error.code, message: error.message };
}
