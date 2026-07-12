import type { ProjectAuthHealth } from '../../projectAuthHealth';
import { analyzeProjectAuthHealth } from '../../projectAuthHealth';
import type { ProjectManager } from '../orchestrator/projectManager';
import type { ProjectSecretService } from '../secrets/projectSecretService';

type ProjectAuthHealthManager = Pick<ProjectManager, 'getProjectManifest' | 'getStudioManifest'>;

export class ProjectAuthHealthService {
  private readonly projectManager: ProjectAuthHealthManager;
  private readonly secretService: Pick<ProjectSecretService, 'list'>;

  constructor(options: {
    readonly projectManager: ProjectAuthHealthManager;
    readonly secretService: Pick<ProjectSecretService, 'list'>;
  }) {
    this.projectManager = options.projectManager;
    this.secretService = options.secretService;
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

    return {
      ok: true,
      state: 'loaded',
      data: analyzeProjectAuthHealth({
        manifest,
        secretMetadata: secretResult.ok ? secretResult.data : [],
        secretStoreAvailable: secretResult.ok,
      }),
    };
  }

  private async readEditableManifest(projectId: string) {
    try {
      return await this.projectManager.getStudioManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
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
