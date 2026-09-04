import type { AppCategory, AppManifest, ThemeConfig } from '@ankhorage/contracts';

export interface StudioProjectSummary {
  id: string;
  name: string;
  path: string;
  version: string;
  isAnkhApp: boolean;
  category: AppCategory;
  created?: string;
  updated?: string;
  activeTheme: ThemeConfig;
  activeThemeMode?: AppManifest['activeThemeMode'];
}

export type ProjectSortKey = 'updated-desc' | 'name-asc';

export type ProjectCreationValidationCode =
  | 'empty-name'
  | 'invalid-project-id'
  | 'project-id-exists'
  | 'project-name-exists'
  | 'reserved-project-id';

export interface ProjectCreationValidationFailure {
  code: ProjectCreationValidationCode;
  message: string;
}

export type ProjectCreationValidationResult =
  | { ok: true; projectId: string }
  | { ok: false; projectId: string; reason: ProjectCreationValidationFailure };
