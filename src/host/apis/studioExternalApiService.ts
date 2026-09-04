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
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ManualRestApiRequest,
} from '../../externalApiAuthoringContracts';
import { normalizeExternalApiId } from '../../normalizeExternalApiId';
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

/***
 * Trim an optional string and normalize blank values to undefined.
 * @utility @ankhorage/utility/value
 */
function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === '' ? undefined : normalized;
}
