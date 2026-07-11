import type { ProjectManager } from '../orchestrator/projectManager';
import {
  applyStudioAuthSettings,
  readStudioAuthSettings,
  type StudioAuthSettings,
  validateStudioAuthSettings,
} from '../../authSettings';

export type ProjectAuthSettingsResult =
  | {
      readonly ok: true;
      readonly state: 'loaded' | 'saved';
      readonly data: StudioAuthSettings | null;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'invalid_config' | 'manifest_read_failed' | 'manifest_write_failed';
        readonly message: string;
      };
    };

type ProjectAuthManager = Pick<
  ProjectManager,
  'getProjectManifest' | 'getStudioManifest' | 'saveStudioManifest'
>;

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

  async configure(projectId: string, value: unknown): Promise<ProjectAuthSettingsResult> {
    const parsed = validateStudioAuthSettings(value);
    if (!parsed.ok) return parsed;

    let manifest;
    try {
      manifest = await this.readEditableManifest(projectId);
    } catch {
      return {
        ok: false,
        error: {
          code: 'manifest_read_failed',
          message: 'The project authentication configuration could not be loaded.',
        },
      };
    }

    const nextManifest = applyStudioAuthSettings(manifest, parsed.data);
    try {
      await this.projectManager.saveStudioManifest({ projectId, manifest: nextManifest });
    } catch {
      return {
        ok: false,
        error: {
          code: 'manifest_write_failed',
          message: 'The canonical authentication configuration could not be saved.',
        },
      };
    }

    return { ok: true, state: 'saved', data: readStudioAuthSettings(nextManifest) };
  }

  private async readEditableManifest(projectId: string) {
    try {
      return await this.projectManager.getStudioManifest(projectId);
    } catch {
      return this.projectManager.getProjectManifest(projectId);
    }
  }
}
