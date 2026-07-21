import type { ProjectSortKey, StudioProjectSummary } from './projectWorkspaceContracts';
import type { TemplateCatalog, TemplateEntry } from './templateCatalogContracts';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function scoreText(target: string, query: string): number {
  if (!query) return 0;
  if (target === query) return 100;
  if (target.startsWith(query)) return 50;
  if (target.includes(query)) return 25;
  return 0;
}

function compareProjects(a: StudioProjectSummary, b: StudioProjectSummary, sort: ProjectSortKey) {
  if (sort === 'name-asc') {
    return a.name.localeCompare(b.name);
  }

  const aTime = Date.parse(a.updated ?? a.created ?? '');
  const bTime = Date.parse(b.updated ?? b.created ?? '');
  const normalizedATime = Number.isFinite(aTime) ? aTime : 0;
  const normalizedBTime = Number.isFinite(bTime) ? bTime : 0;
  return normalizedBTime - normalizedATime || a.name.localeCompare(b.name);
}

export function filterAndSortProjects(
  projects: readonly StudioProjectSummary[],
  queryRaw: string,
  sort: ProjectSortKey,
): StudioProjectSummary[] {
  const sorted = [...projects].sort((a, b) => compareProjects(a, b, sort));
  const query = normalize(queryRaw);
  if (!query) return sorted;

  return sorted
    .map((project) => {
      const score = Math.max(
        scoreText(normalize(project.name), query),
        scoreText(normalize(project.id), query),
        scoreText(normalize(project.category), query),
        scoreText(normalize(project.version), query),
      );

      return { project, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || compareProjects(a.project, b.project, sort))
    .map((entry) => entry.project);
}

function getTemplateEntries(catalog: TemplateCatalog): TemplateEntry[] {
  return catalog.categories.flatMap((category) =>
    category.templates.map((template) => ({
      ...template,
      category: category.id,
      categoryLabel: category.label,
    })),
  );
}

export function filterAndSortTemplates(
  catalog: TemplateCatalog,
  queryRaw: string,
): TemplateEntry[] {
  const entries = getTemplateEntries(catalog);
  const query = normalize(queryRaw);
  if (!query) return entries;

  return entries
    .map((template) => {
      const score = Math.max(
        scoreText(normalize(template.name), query),
        scoreText(normalize(template.id), query),
        scoreText(normalize(template.templateId), query),
        scoreText(normalize(template.description), query),
        scoreText(normalize(template.category), query),
        scoreText(normalize(template.categoryLabel), query),
      );

      return { template, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name))
    .map((entry) => entry.template);
}
