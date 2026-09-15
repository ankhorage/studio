import { readOwnProperty } from '@ankhorage/utility/object';

import type { ProjectAuthHealth } from '../../projectAuthHealth';
import { analyzeProjectAuthHealth } from '../../projectAuthHealth';
import { applyProjectAuthRuntimeDiagnostics } from '../../projectAuthRuntimeDiagnostics';
import { resolveProjectAuthEnvironment } from '../../projectOAuthSetup';
import type { ProjectManager } from '../orchestrator/projectManager';
import type { ProjectSecretService } from '../secrets/projectSecretService';
import { observeProjectAuthRuntimeDiagnostics } from './projectAuthRuntimeDiagnostics';

type ProjectAuthHealthManager = Pick<
  ProjectManager,
  'getInfrastructureOutputs' | 'getInfrastructureStatus' | 'getProjectManifest'
>;

export class ProjectAuthHealthService {
  private readonly projectManager: ProjectAuthHealthManager;
  private readonly secretService: Pick<ProjectSecretService, 'list'>;

  /***
   * Create the Studio host service that combines authored Auth state, secret availability, and provider-neutral Infra diagnostics.
   * @todo Move this service under the auth domain's host/application boundary.
   */
  constructor(options: {
    readonly projectManager: ProjectAuthHealthManager;
    readonly secretService: Pick<ProjectSecretService, 'list'>;
    readonly workspaceRoot: string;
  }) {
    this.projectManager = options.projectManager;
    this.secretService = options.secretService;
  }

  /*** Resolve one project's bounded Auth health result without relying on provider-specific runtime scripts. */
  async get(input: {
    readonly projectId: string;
    readonly environment?: string;
  }): Promise<ProjectAuthHealthResult> {
    let manifest;
    try {
      manifest = await this.projectManager.getProjectManifest(input.projectId);
    } catch {
      return {
        ok: false,
        error: {
          code: 'manifest_read_failed',
          message: 'The project authentication configuration could not be loaded.',
        },
      };
    }

    const environment = resolveProjectAuthEnvironment(input.environment);
    const secretResult = await this.secretService.list({
      projectId: input.projectId,
      environment,
    });
    const desiredHealth = analyzeProjectAuthHealth({
      manifest,
      secretMetadata: secretResult.ok ? secretResult.data : [],
      secretStoreAvailable: secretResult.ok,
      environment,
    });
    const environmentSpec = readOwnProperty(manifest.infra.environments, environment);
    const oauth = environmentSpec?.auth?.oauth;

    if (!oauth?.enabled || !oauth.providers.some((provider) => provider.enabled === true)) {
      return {
        ok: true,
        state: 'loaded',
        data: desiredHealth,
      };
    }

    try {
      const [infraStatus, infraOutputs] = await Promise.all([
        this.projectManager.getInfrastructureStatus(input.projectId),
        this.projectManager.getInfrastructureOutputs(input.projectId),
      ]);
      const publicBaseUrl = environmentSpec?.networking?.publicBaseUrl;
      const runtimeDiagnostics = observeProjectAuthRuntimeDiagnostics({
        status: infraStatus,
        outputs: infraOutputs.outputs,
        callbackRoute: oauth.callbackRoute,
        ...(publicBaseUrl ? { publicBaseUrl } : {}),
      });

      return {
        ok: true,
        state: 'loaded',
        data: applyProjectAuthRuntimeDiagnostics(desiredHealth, runtimeDiagnostics),
      };
    } catch {
      return {
        ok: true,
        state: 'loaded',
        data: applyProjectAuthRuntimeDiagnostics(desiredHealth, {
          appCallbackTargets: [],
          redirectAllowList: [],
          rolloutStatus: 'unavailable',
        }),
      };
    }
  }
}

export type ProjectAuthHealthResult =
  | {
      readonly ok: true;
      readonly state: 'loaded';
      readonly data: ProjectAuthHealth;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'manifest_read_failed';
        readonly message: string;
      };
    };
