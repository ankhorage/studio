import type { AuthRedirectEnvironment } from '@ankhorage/infra';

import type { ProjectAuthHealth } from '../../projectAuthHealth';
import { analyzeProjectAuthHealth } from '../../projectAuthHealth';
import { applyProjectAuthRuntimeDiagnostics } from '../../projectAuthRuntimeDiagnostics';
import type { ProjectManager } from '../orchestrator/projectManager';
import type { ProjectSecretService } from '../secrets/projectSecretService';
import { observeProjectAuthRuntimeDiagnostics } from './projectAuthRuntimeDiagnostics';

type ProjectAuthHealthManager = Pick<
  ProjectManager,
  'getInfrastructureStatus' | 'getProjectManifest' | 'getStudioManifest'
>;

export class ProjectAuthHealthService {
  private readonly projectManager: ProjectAuthHealthManager;
  private readonly secretService: Pick<ProjectSecretService, 'list'>;
  private readonly workspaceRoot: string;

  constructor(options: {
    readonly projectManager: ProjectAuthHealthManager;
    readonly secretService: Pick<ProjectSecretService, 'list'>;
    readonly workspaceRoot: string;
  }) {
    this.projectManager = options.projectManager;
    this.secretService = options.secretService;
    this.workspaceRoot = options.workspaceRoot;
  }

  async get(input: {
    readonly projectId: string;
    readonly environment?: string;
  }): Promise<ProjectAuthHealthResult> {
    let manifest;
    try {
      manifest = await this.readEditableManifest(input.projectId);
    } catch {
      return {
        ok: false,
        error: {
          code: 'manifest_read_failed',
          message: 'The project authentication configuration could not be loaded.',
        },
      };
    }

    const secretResult = await this.secretService.list({
      projectId: input.projectId,
      environment: input.environment,
    });
    const desiredHealth = analyzeProjectAuthHealth({
      manifest,
      secretMetadata: secretResult.ok ? secretResult.data : [],
      secretStoreAvailable: secretResult.ok,
    });
    const oauth = manifest.infra.auth?.oauth;

    if (!oauth?.enabled || !oauth.providers.some((provider) => provider.enabled === true)) {
      return {
        ok: true,
        state: 'loaded',
        data: desiredHealth,
      };
    }

    try {
      const infraStatus = await this.projectManager.getInfrastructureStatus(input.projectId);
      const runtimeDiagnostics = await observeProjectAuthRuntimeDiagnostics({
        rootPath: this.workspaceRoot,
        projectId: input.projectId,
        target: infraStatus.target,
        generated: infraStatus.hasLedger,
        environment: resolveAuthRedirectEnvironment(input.environment),
        callbackRoute: oauth.callbackRoute,
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

  private async readEditableManifest(projectId: string) {
    try {
      return await this.projectManager.getStudioManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
    }
  }
}

function resolveAuthRedirectEnvironment(environment: string | undefined): AuthRedirectEnvironment {
  if (environment === 'preview' || environment === 'production') return environment;
  return 'local';
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
