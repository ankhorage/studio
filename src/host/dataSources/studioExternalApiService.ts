import type { AppManifest } from '@ankhorage/contracts';
import type { ApiDataSourceConfig, DataSourceDiagnostic } from '@ankhorage/contracts/data';
import {
  createManualRestDataSource,
  discoverOpenApiDataSource,
  type EndpointTestFetch,
  type ExternalApiFetch,
  introspectGraphQlDataSource,
  testEndpoint,
} from '@ankhorage/data-sources';

import type {
  ExternalApiConnectRequest,
  ExternalApiConnectResult,
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ManualRestSourceRequest,
} from '../../externalApiAuthoringContracts';
import { normalizeExternalApiSourceId } from '../../normalizeExternalApiSourceId';
import { upsertExternalApiDataSource } from '../../upsertExternalApiDataSource';
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

export class StudioExternalApiService {
  private readonly projectManager: ExternalApiProjectStore;
  private readonly discoveryFetch: ExternalApiFetch;
  private readonly endpointFetch: EndpointTestFetch;
  private readonly secretService?: Pick<ProjectSecretService, 'resolve'>;

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

  async connect(
    projectId: string,
    request: ExternalApiConnectRequest,
  ): Promise<ExternalApiConnectResult> {
    const normalized = normalizeExternalApiSourceId(request.sourceId);
    if (!normalized.ok) return invalidResult(normalized.message);
    const input = { ...request, sourceId: normalized.sourceId };

    if (input.protocol === 'graphql') return this.connectGraphQl(projectId, input, []);
    const openApi = await this.discoverOpenApi(input);
    if (openApi.ok) return this.persist(projectId, openApi.data, openApi.attempts);
    if (input.protocol === 'openapi') return openApi;
    return this.connectGraphQl(projectId, input, openApi.attempts, openApi.diagnostics);
  }

  async createManualRest(
    projectId: string,
    request: ManualRestSourceRequest,
  ): Promise<ExternalApiConnectResult> {
    const normalized = normalizeExternalApiSourceId(request.sourceId);
    if (!normalized.ok) return invalidResult(normalized.message);
    const result = createManualRestDataSource({
      id: normalized.sourceId,
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

  async testOperation(
    projectId: string,
    request: ExternalApiOperationTestRequest,
  ): Promise<ExternalApiOperationTestResult> {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const source = manifest.dataSources?.[request.sourceId];
    if (!source) return missingSourceResult(request.sourceId);
    if (source.kind !== 'api' || source.origin !== 'external') {
      return unsupportedTestSourceResult(request.sourceId);
    }
    const credentialResolver = this.secretService
      ? createProjectEndpointCredentialResolver({
          projectId,
          service: this.secretService,
        })
      : undefined;
    const result = await testEndpoint({
      dataSource: source,
      endpointId: request.endpointId,
      operationId: request.operationId,
      values: request.values,
      dryRun: request.dryRun,
      fetch: this.endpointFetch,
      credentialResolver,
    });
    return sanitizeExternalApiOperationTestResult(result);
  }

  private discoverOpenApi(request: ExternalApiConnectRequest) {
    return discoverOpenApiDataSource({
      id: request.sourceId,
      url: request.url,
      fetch: this.discoveryFetch,
      name: clean(request.name),
      description: clean(request.description),
      credential: request.credential,
    });
  }

  private async connectGraphQl(
    projectId: string,
    request: ExternalApiConnectRequest,
    attempts: ExternalApiConnectResult['attempts'],
    previousDiagnostics: readonly DataSourceDiagnostic[] = [],
  ): Promise<ExternalApiConnectResult> {
    const result = await introspectGraphQlDataSource({
      id: request.sourceId,
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

  private async persist(
    projectId: string,
    source: ApiDataSourceConfig,
    attempts: ExternalApiConnectResult['attempts'],
    diagnostics: readonly DataSourceDiagnostic[] = [],
  ): Promise<ExternalApiConnectResult> {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const upsert = upsertExternalApiDataSource(manifest.dataSources ?? {}, source);
    await this.projectManager.persistProjectManifest({
      projectId,
      manifest: { ...manifest, dataSources: upsert.registry },
    });
    return {
      ok: true,
      sourceId: source.id,
      kind: source.kind,
      protocol: source.protocol,
      created: upsert.created,
      attempts,
      diagnostics,
    };
  }
}

function invalidResult(message: string): ExternalApiConnectResult {
  return {
    ok: false,
    attempts: [],
    diagnostics: [{ code: 'invalid-config', message, severity: 'error' }],
  };
}

function unsupportedTestSourceResult(sourceId: string): ExternalApiOperationTestResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'invalid-config',
        dataSourceId: sourceId,
        message: 'Studio HTTP operation testing supports external API sources only.',
        severity: 'error',
      },
    ],
  };
}

function missingSourceResult(sourceId: string): ExternalApiOperationTestResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: 'missing-data-source',
        dataSourceId: sourceId,
        message: `Data source '${sourceId}' could not be found.`,
        severity: 'error',
      },
    ],
  };
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized;
}
