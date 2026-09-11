import type { AppManifest } from '@ankhorage/contracts';
import type {
  DataSourceDiagnostic,
  ExternalGraphQlApiDefinition,
  ExternalRestApiDefinition,
} from '@ankhorage/contracts/data';
import {
  createManualRestApi,
  discoverOpenApi,
  type EndpointTestFetch,
  type ExternalApiFetch,
  introspectGraphQlApi,
  testEndpoint,
} from '@ankhorage/data-sources';

import type {
  ExternalApiConnectRequest,
  ExternalApiConnectResult,
  ExternalApiMutationResult,
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ExternalApiRemoveRequest,
  ManualRestApiRequest,
  ManualRestApiSettingsRequest,
} from '../../externalApiAuthoringContracts';
import { normalizeExternalApiId } from '../../normalizeExternalApiId';
import { removeExternalApi } from '../../removeExternalApi';
import { upsertExternalApi } from '../../upsertExternalApi';
import type { ProjectManager } from '../orchestrator/projectManager';
import type { ProjectSecretService } from '../secrets/projectSecretService';
import { createProjectEndpointCredentialResolver } from './createProjectEndpointCredentialResolver';
import { createTrustedEndpointTestFetch } from './createTrustedEndpointTestFetch';
import { createTrustedExternalApiFetch } from './createTrustedExternalApiFetch';
import { sanitizeExternalApiOperationTestResult } from './sanitizeExternalApiOperationTestResult';

interface ExternalApiProjectStore {
  getProjectManifest(projectId: string): Promise<AppManifest>;
  persistProjectManifest(args: { projectId: string; manifest: AppManifest }): Promise<unknown>;
}

type ExternalApiDefinition = ExternalGraphQlApiDefinition | ExternalRestApiDefinition;

export class StudioExternalApiService {
  private readonly projectManager: ExternalApiProjectStore;
  private readonly discoveryFetch: ExternalApiFetch;
  private readonly endpointFetch: EndpointTestFetch;
  private readonly secretService?: Pick<ProjectSecretService, 'resolve'>;

  /***
   * Create the Studio host service that owns external-API discovery, testing, and manifest persistence.
   * @todo Move this service from the generic host subtree to the external-apis domain's host adapter.
   */
  constructor(options: {
    readonly projectManager: Pick<ProjectManager, 'getProjectManifest' | 'persistProjectManifest'>;
    readonly discoveryFetch?: ExternalApiFetch;
    readonly endpointFetch?: EndpointTestFetch;
    readonly secretService?: Pick<ProjectSecretService, 'resolve'>;
  }) {
    this.projectManager = options.projectManager;
    this.discoveryFetch = options.discoveryFetch ?? createTrustedExternalApiFetch();
    this.endpointFetch = options.endpointFetch ?? createTrustedEndpointTestFetch();
    this.secretService = options.secretService;
  }

  /*** Discover and persist an external API using the requested protocol with automatic fallback where allowed. */
  async connect(
    projectId: string,
    request: ExternalApiConnectRequest,
  ): Promise<ExternalApiConnectResult> {
    const normalized = normalizeExternalApiId(request.apiId);
    if (!normalized.ok) return invalidResult(normalized.message);
    const input = { ...request, apiId: normalized.apiId };

    if (input.protocol === 'graphql') return this.connectGraphQl(projectId, input, []);
    const openApi = await this.discoverOpenApi(input);
    if (openApi.ok) return this.persist(projectId, openApi.data, openApi.attempts);
    if (input.protocol === 'openapi') return openApi;
    return this.connectGraphQl(projectId, input, openApi.attempts, openApi.diagnostics);
  }

  /*** Create and persist a manually authored REST API definition for a Studio project. */
  async createManualRest(
    projectId: string,
    request: ManualRestApiRequest,
  ): Promise<ExternalApiConnectResult> {
    const normalized = normalizeExternalApiId(request.apiId);
    if (!normalized.ok) return invalidResult(normalized.message);
    const result = createManualRestApi({
      id: normalized.apiId,
      baseUrl: request.baseUrl,
      name: clean(request.name),
      description: clean(request.description),
      credential: request.credential,
      endpoints: [
        {
          id: request.endpointId,
          path: request.path,
          operations: [
            {
              id: request.operationId,
              intent: request.intent,
              method: request.method,
              path: request.path,
            },
          ],
        },
      ],
    });
    return result.ok
      ? this.persist(projectId, result.data, [], result.diagnostics ?? [])
      : { ok: false, attempts: [], diagnostics: result.diagnostics };
  }

  /*** Update editable metadata and base URL on one manually authored REST API while preserving its canonical operations. */
  async updateManualRestSettings(
    projectId: string,
    request: ManualRestApiSettingsRequest,
  ): Promise<ExternalApiMutationResult> {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const api = manifest.infra.apis?.find((candidate) => candidate.id === request.apiId);
    if (!api) return missingApiMutationResult(request.apiId);
    if (api.origin !== 'external' || api.protocol !== 'rest' || api.openApi) {
      return invalidMutationResult(
        'Only manually authored external REST APIs can update settings without rediscovery.',
      );
    }

    const baseUrl = normalizeExternalApiUrl(request.baseUrl);
    if (!baseUrl) return invalidMutationResult('Enter a valid HTTP or HTTPS API URL.');
    const updated: ExternalRestApiDefinition = {
      ...api,
      baseUrl,
      name: clean(request.name),
      description: clean(request.description),
      credential: request.credential,
    };
    const upsert = upsertExternalApi(manifest.infra.apis ?? [], updated);
    await this.projectManager.persistProjectManifest({
      projectId,
      manifest: { ...manifest, infra: { ...manifest.infra, apis: upsert.apis } },
    });
    return { ok: true, apiId: updated.id, diagnostics: [] };
  }

  /*** Remove exactly one existing external API from canonical manifest state. */
  async remove(
    projectId: string,
    request: ExternalApiRemoveRequest,
  ): Promise<ExternalApiMutationResult> {
    const apiId = request.apiId.trim();
    if (!apiId) return invalidMutationResult('API ID is required.');
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const api = manifest.infra.apis?.find((candidate) => candidate.id === apiId);
    if (!api) return missingApiMutationResult(apiId);
    if (api.origin !== 'external') {
      return invalidMutationResult('Only connected external APIs can be removed from this catalog.');
    }

    const removal = removeExternalApi(manifest.infra.apis ?? [], apiId);
    await this.projectManager.persistProjectManifest({
      projectId,
      manifest: { ...manifest, infra: { ...manifest.infra, apis: removal.apis } },
    });
    return { ok: true, apiId, diagnostics: [] };
  }

  /*** Execute one authored external API operation against the project's current manifest and credential resolver. */
  async testOperation(
    projectId: string,
    request: ExternalApiOperationTestRequest,
  ): Promise<ExternalApiOperationTestResult> {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const api = manifest.infra.apis?.find((candidate) => candidate.id === request.apiId);
    if (!api) return missingApiResult(request.apiId);
    if (api.origin !== 'external') return unsupportedTestApiResult(request.apiId);

    const credentialResolver = this.secretService
      ? createProjectEndpointCredentialResolver({ projectId, service: this.secretService })
      : undefined;
    const result = await testEndpoint({
      api,
      endpointId: request.endpointId,
      operationId: request.operationId,
      values: request.values,
      dryRun: request.dryRun,
      fetch: this.endpointFetch,
      credentialResolver,
    });
    return sanitizeExternalApiOperationTestResult(result);
  }

  /*** Run OpenAPI discovery through the service's trusted discovery transport. */
  private discoverOpenApi(request: ExternalApiConnectRequest) {
    return discoverOpenApi({
      id: request.apiId,
      url: request.url,
      fetch: this.discoveryFetch,
      name: clean(request.name),
      description: clean(request.description),
      credential: request.credential,
    });
  }

  /*** Run GraphQL introspection and merge diagnostics from any previous discovery attempt. */
  private async connectGraphQl(
    projectId: string,
    request: ExternalApiConnectRequest,
    attempts: ExternalApiConnectResult['attempts'],
    previousDiagnostics: readonly DataSourceDiagnostic[] = [],
  ): Promise<ExternalApiConnectResult> {
    const result = await introspectGraphQlApi({
      id: request.apiId,
      endpointUrl: request.url,
      fetch: this.discoveryFetch,
      name: clean(request.name),
      description: clean(request.description),
      credential: request.credential,
    });
    return result.ok
      ? this.persist(projectId, result.data, attempts, result.diagnostics)
      : {
          ok: false,
          attempts,
          diagnostics: [...previousDiagnostics, ...result.diagnostics],
        };
  }

  /*** Upsert an external API into the project manifest and persist the resulting canonical manifest. */
  private async persist(
    projectId: string,
    api: ExternalApiDefinition,
    attempts: ExternalApiConnectResult['attempts'],
    diagnostics: readonly DataSourceDiagnostic[] = [],
  ): Promise<ExternalApiConnectResult> {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const upsert = upsertExternalApi(manifest.infra.apis ?? [], api);
    await this.projectManager.persistProjectManifest({
      projectId,
      manifest: { ...manifest, infra: { ...manifest.infra, apis: upsert.apis } },
    });
    return {
      ok: true,
      apiId: api.id,
      protocol: api.protocol,
      created: upsert.created,
      attempts,
      diagnostics,
    };
  }
}

/*** Create the external-API connect failure returned for invalid authoring configuration. */
function invalidResult(message: string): ExternalApiConnectResult {
  return {
    ok: false,
    attempts: [],
    diagnostics: [{ code: 'invalid-config', message, severity: 'error' }],
  };
}

/*** Create an external-API mutation failure returned for invalid edit or removal configuration. */
function invalidMutationResult(message: string): ExternalApiMutationResult {
  return {
    ok: false,
    diagnostics: [{ code: 'invalid-config', message, severity: 'error' }],
  };
}

/*** Create the external-API mutation failure returned when the requested canonical API does not exist. */
function missingApiMutationResult(apiId: string): ExternalApiMutationResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'missing-api',
        apiId,
        message: `API '${apiId}' could not be found.`,
        severity: 'error',
      },
    ],
  };
}

/*** Create the operation-test failure returned when a configured API is not an external API. */
function unsupportedTestApiResult(apiId: string): ExternalApiOperationTestResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'invalid-config',
        apiId,
        message: 'Studio operation testing supports external APIs only in Phase 1.',
        severity: 'error',
      },
    ],
  };
}

/*** Create the operation-test failure returned when the requested API does not exist. */
function missingApiResult(apiId: string): ExternalApiOperationTestResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'missing-api',
        apiId,
        message: `API '${apiId}' could not be found.`,
        severity: 'error',
      },
    ],
  };
}

/*** Normalize and validate an editable manual REST base URL before canonical persistence. */
function normalizeExternalApiUrl(value: string): string | null {
  const normalized = value.trim();
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null;
  } catch {
    return null;
  }
}

/***
 * Trim an optional string and normalize blank values to undefined.
 * @utility @ankhorage/utility/value
 */
function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === '' ? undefined : normalized;
}
