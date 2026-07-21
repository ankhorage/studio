import type { AppCategory, ThemeConfig } from '@ankhorage/contracts';

export interface TemplateCatalogTemplate {
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
