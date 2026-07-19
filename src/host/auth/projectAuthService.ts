import {
  readStudioAuthSettings,
  type StudioAuthSettings,
  validateStudioAuthSettings,
} from '../../authSettings';
import type { ProjectManager } from '../orchestrator/projectManager';

export type ProjectAuthSettingsResult =
  | {
      readonly ok: true;
      readonly state: 'loaded' | 'saved';
      readonly data: StudioAuthSettings | null;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'invalid_config' | 'manifest_read_failed' | 'manifest_write_disabled';
        readonly message: string;
      };
    };

type ProjectAuthManager = Pick<ProjectManager, 'getProjectManifest' | 'getStudioManifest'>;

export class ProjectAuthService {
  constructor(private readonly projectManager: ProjectAuthManager) {}

  async get(projectId: string): Promise<ProjectAuthSettingsResult> {
    try {
      const manifest = await this.readEditableManifest(projectId);
      return { ok: true, state: 'loaded', data: readStudioAuthSettings(manifest) };
    } catch {
      return {
        ok: false,
        error: {
          code: 'manifest_read_failed',
          message: 'The project authentication configuration could not be loaded.',
        },
      };
    }
  }

  configure(projectId: string, value: unknown): Promise<ProjectAuthSettingsResult> {
    const parsed = validateStudioAuthSettings(value);
    if (!parsed.ok) return Promise.resolve(parsed);
    void projectId;

    return Promise.resolve({
      ok: false,
      error: {
        code: 'manifest_write_disabled',
        message:
          'Authentication manifest changes must be written through the Studio manifest draft.',
      },
    });
  }

  private async readEditableManifest(projectId: string) {
    try {
      return await this.projectManager.getStudioManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
    }
  }
}
