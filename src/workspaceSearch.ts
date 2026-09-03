import type { ProjectSortKey, StudioProjectSummary } from './projectWorkspaceContracts';
import type { TemplateCatalog, TemplateEntry } from './templateCatalogContracts';

/***
 * Normalize free-text search input for case-insensitive matching.
 * @utility @ankhorage/utility/search
 */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/***
 * Score an already-normalized target by exact, prefix, or substring match quality.
 * @utility @ankhorage/utility/search
 */
function scoreText(target: string, query: string): number {
  if (!query) return 0;
  if (target === query) return 100;
  if (target.startsWith(query)) return 50;
  if (target.includes(query)) return 25;
  return 0;
}

/***
 * Compare Studio projects by configured name or most-recent activity ordering.
 * @todo Move project sorting behavior under src/projects/ or src/workspace/ with its owning project list use case.
 */
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

/***
 * Filter and sort Studio project summaries using workspace search fields and project sort policy.
 * @todo Move project search behavior under src/projects/ or src/workspace/ rather than a direct src/ file.
 */
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

/***
 * Flatten the categorized Studio template catalog into entries carrying their category metadata.
 * @todo Move template catalog projection under src/templates/.
 */
function getTemplateEntries(catalog: TemplateCatalog): TemplateEntry[] {
  return catalog.categories.flatMap((category) =>
    category.templates.map((template) => ({
      ...template,
      category: category.id,
      categoryLabel: category.label,
    })),
  );
}

/***
 * Filter Studio template entries by their searchable authored and category fields.
 * @todo Move template search behavior under src/templates/.
 */
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
