import type { AppCategory, AppManifest } from '@ankhorage/contracts';
import {
  CATEGORY_PRESETS,
  createStarterTemplate,
  listStarterTemplateSummaries,
  type TemplateSeed,
} from '@ankhorage/templates';

import type {
  TemplateCatalog,
  TemplateCatalogCategory,
  TemplateCatalogTemplate,
} from '../../templateCatalogContracts';

export interface ProjectTemplateSelection {
  category: AppCategory;
  templateId: string;
}

type IndexedProjectTemplate = TemplateCatalogTemplate & {
  category: AppCategory;
};

function createProjectTemplateId(selection: ProjectTemplateSelection): string {
  return `${selection.category}/${selection.templateId}`;
}

function createSeed(category: AppCategory): TemplateSeed {
  const preset = CATEGORY_PRESETS[category];

  return {
    category,
    categoryLabel: preset.label,
    appName: preset.defaultName,
    slug: preset.defaultSlug,
    summary: preset.summary,
    focusAreas: preset.focusAreas,
    primaryColor: preset.primaryColor,
    harmony: preset.harmony,
  };
}

function normalizeProjectTemplateManifest(
  selection: ProjectTemplateSelection,
  manifest: AppManifest,
): AppManifest {
  if (
    selection.category !== 'food_drink' ||
    selection.templateId !== 'nutrition-catalog-scan' ||
    manifest.navigator.type !== 'tabs'
  ) {
    return manifest;
  }

  const normalizedRoutes = manifest.navigator.routes.filter(
    (route) => !(route.hideInTabBar === true && route.path === '/'),
  );

  return {
    ...manifest,
    navigator: {
      ...manifest.navigator,
      routes: normalizedRoutes,
    },
  };
}

function buildProjectTemplate(selection: ProjectTemplateSelection): AppManifest {
  return normalizeProjectTemplateManifest(
    selection,
    createStarterTemplate(createSeed(selection.category), {
      templateId: selection.templateId,
    }),
  );
}

const PROJECT_TEMPLATE_INDEX = createTemplateIndex();
const PROJECT_TEMPLATE_CATALOG = createTemplateCatalog();

export function getProjectTemplate(selection: ProjectTemplateSelection): AppManifest {
  const summary = PROJECT_TEMPLATE_INDEX.find(
    (template) =>
      template.category === selection.category && template.templateId === selection.templateId,
  );

  if (!summary) {
    throw new Error(
      `Template '${selection.category}/${selection.templateId}' not found in published templates package.`,
    );
  }

  return buildProjectTemplate(selection);
}

export function getTemplateCatalog(): TemplateCatalog {
  return {
    categories: PROJECT_TEMPLATE_CATALOG.categories.map((category) => ({
      ...category,
      focusAreas: [...category.focusAreas],
      templates: category.templates.map((template) => ({ ...template })),
    })),
  };
}

function createTemplateIndex(): readonly IndexedProjectTemplate[] {
  return listStarterTemplateSummaries().map((summary) => {
    const selection = {
      category: summary.category,
      templateId: summary.id,
    } satisfies ProjectTemplateSelection;

    return {
      id: createProjectTemplateId(selection),
      category: summary.category,
      templateId: summary.id,
      name: summary.label,
      description: summary.description,
    };
  });
}

function createTemplateCatalog(): TemplateCatalog {
  const categories = Object.entries(CATEGORY_PRESETS).map(([categoryId, preset]) => {
    const category = categoryId as AppCategory;
    const templates: TemplateCatalogTemplate[] = PROJECT_TEMPLATE_INDEX.filter(
      (summary) => summary.category === category,
    ).map(({ category: _category, ...template }) => template);

    return {
      id: category,
      label: preset.label,
      summary: preset.summary,
      focusAreas: [...preset.focusAreas],
      primaryColor: preset.primaryColor,
      harmony: preset.harmony,
      templateCount: templates.length,
      templates,
    } satisfies TemplateCatalogCategory;
  });

  return { categories };
}
