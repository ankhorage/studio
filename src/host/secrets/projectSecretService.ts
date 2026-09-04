import { type AppManifest, type AuthOAuthProviderId } from '@ankhorage/contracts';
import {
  normalizeSecretRef,
  type SecretCreateInput,
  type SecretListInput,
  type SecretMetadata,
  type SecretPayload,
  type SecretReplaceInput,
  type SecretResolveInput,
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
  readonly resolveDatabaseUrl?: (projectPath: string, target: string) => Promise<string>;
}

export interface ConfigureOAuthProviderInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly providerId: AuthOAuthProviderId;
  readonly payload: SecretPayload;
  readonly credentialsRef?: string;
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
      readonly state: 'secret_write_failed';
      readonly error: { readonly code: string; readonly message: string };
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

export class ProjectSecretUsageError extends Error {
  readonly code: string;

  /*** Create the domain error used when a secret reference cannot be inspected safely. */
  constructor(args: { readonly code: string; readonly message: string }) {
    super(args.message);
    this.name = 'ProjectSecretUsageError';
    this.code = args.code;
  }
}

export class ProjectSecretService {
  private readonly projectManager: ProjectManager;
  private readonly workspaceRoot: string;
  private readonly createClient: (databaseUrl: string) => BunSupabaseVaultClient;
  private readonly resolveDatabaseUrl: (projectPath: string, target: string) => Promise<string>;

  /***
   * @todo Keep this service in the Secrets application/host boundary; it owns project secret-store lifecycle and trusted Vault access rather than generic persistence.
   * Create the project-scoped secret application service with injectable trusted Vault boundaries.
   */
  constructor(options: ProjectSecretServiceOptions) {
    this.projectManager = options.projectManager;
    this.workspaceRoot = options.workspaceRoot;
    this.createClient = options.createClient ?? createBunSupabaseVaultClient;
    this.resolveDatabaseUrl =
      options.resolveDatabaseUrl ??
      ((projectPath, target) => resolveProjectSecretDatabaseUrl({ projectPath, target }));
  }

  /*** List secret metadata for a project/environment scope with optional kind and provider filters. */
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

  /*** Read secret metadata for one project-scoped reference without resolving its payload. */
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

  /*** Create a new project secret through the configured Infra secret-store adapter. */
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

  /*** Replace the payload stored behind an existing project secret reference. */
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

  /*** Remove one project secret directly from the configured secret store. */
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

  /*** Resolve the trusted payload behind one project-scoped secret reference. */
  resolve(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
  }): Promise<SecretStoreResult<SecretPayload>> {
    return this.withAdapter(input.projectId, (adapter) =>
      adapter.resolve({
        scope: createScope(input.projectId, input.environment),
        ref: input.ref,
      } satisfies SecretResolveInput),
    );
  }

  /*** Inspect the current project manifest and report every usage of a normalized secret reference. */
  async getUsages(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
  }): Promise<ProjectSecretUsageSummary> {
    const refResult = normalizeSecretRef(input.ref);
    if (!refResult.ok) {
      throw new ProjectSecretUsageError(refResult.error);
    }

    const manifest = await this.readEditableManifest(input.projectId);
    return findProjectSecretUsages({ manifest, ref: refResult.data });
  }

  /***
   * Remove a secret only after evaluating current manifest usages and requiring explicit confirmation for broken references.
   */
  async removeGuarded(input: {
    readonly projectId: string;
    readonly environment?: string;
    readonly ref: string;
    readonly confirmBrokenReferences?: boolean;
  }): Promise<ProjectSecretRemoveResult> {
    let client: BunSupabaseVaultClient | null = null;
    const refResult = normalizeSecretRef(input.ref);
    if (!refResult.ok) {
      return {
        ok: false,
        error: toPublicError(refResult.error),
      };
    }

    try {
      const manifest = await this.readEditableManifest(input.projectId);
      const projectPath = getProjectPath(this.workspaceRoot, input.projectId);
      const infraStatus = await this.projectManager.getInfrastructureStatus(input.projectId);
      if (!infraStatus.target) throw new Error('Project infrastructure target is unavailable.');
      const databaseUrl = await this.resolveDatabaseUrl(projectPath, infraStatus.target);
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

      const usages = findProjectSecretUsages({ manifest, ref: refResult.data });
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
        ref: refResult.data,
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

  /*** Validate and upsert trusted OAuth provider credentials into the project secret store. */
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

    return {
      ok: true,
      state: 'saved',
      metadata: secretResult.data,
      credentialsRef: refResult.data,
    };
  }

  /***
   * @todo Reassess the duplicate manifest retry when the Projects/Secrets boundary is migrated; the second call currently repeats the same read without changing inputs.
   * Read the current editable project manifest, retrying the same manager once on failure.
   */
  private async readEditableManifest(projectId: string): Promise<AppManifest> {
    try {
      return await this.projectManager.getProjectManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
    }
  }

  /*** Open the trusted project secret adapter for one operation and always close its Vault client afterward. */
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
      const infraStatus = await this.projectManager.getInfrastructureStatus(projectId);
      if (!infraStatus.target) throw new Error('Project infrastructure target is unavailable.');
      const databaseUrl = await this.resolveDatabaseUrl(projectPath, infraStatus.target);
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

/*** Build the canonical project/environment scope used by the Secret-store contract. */
function createScope(projectId: string, environment = 'local') {
  return {
    projectId,
    environment: normalizeOptionalText(environment) ?? 'local',
  };
}

/***
 * @utility @ankhorage/utility/value
 * Normalize optional user text to a trimmed non-empty string; this collapses to `asNonEmptyString`.
 */
function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized;
}

/***
 * @utility @ankhorage/utility/error
 * Project a structured error to the public `{ code, message }` pair; this collapses to `pickCodeMessage`.
 */
function toPublicError(error: { readonly code: string; readonly message: string }) {
  return { code: error.code, message: error.message };
}
