import type { AppCategory, AppManifest, ThemeConfig } from '@ankhorage/contracts';

export type StudioProjectManifest = Omit<AppManifest, 'metadata'> & {
  metadata: AppManifest['metadata'] & {
    category: AppCategory;
  };
};

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

interface TemplateCatalogTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
}

export interface TemplateCatalogCategory {
  id: AppCategory;
  label: string;
  summary: string;
  focusAreas: readonly string[];
  primaryColor: string;
  harmony: ThemeConfig['light']['harmony'];
  templateCount: number;
  templates: TemplateCatalogTemplate[];
}

export interface TemplateCatalog {
  categories: TemplateCatalogCategory[];
}

export type TemplateEntry = TemplateCatalogTemplate & {
  category: AppCategory;
  categoryLabel: string;
};

export type ProjectSortKey = 'updated-desc' | 'name-asc';

type ProjectCreationValidationCode =
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
