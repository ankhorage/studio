import type { ProjectItem, TemplateEntry } from './types';

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

export function filterAndSortProjects(projects: ProjectItem[], queryRaw: string): ProjectItem[] {
  const query = normalize(queryRaw);
  if (!query) return projects;

  return projects
    .map((proj) => {
      const name = normalize(proj.name);
      const version = normalize(proj.version);

      const score = scoreText(name, query) + (version.includes(query) ? 10 : 0);

      return { proj, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.proj);
}

export function filterAndSortTemplates(
  entries: TemplateEntry[],
  queryRaw: string,
): TemplateEntry[] {
  const query = normalize(queryRaw);
  if (!query) return entries;

  return entries
    .map((template) => {
      const name = normalize(template.name);
      const version = normalize(template.version);
      const keyLower = normalize(template.id);
      const category = normalize(template.category);
      const templateId = normalize(template.templateId);
      const description = normalize(template.description);

      const score =
        Math.max(
          scoreText(name, query),
          scoreText(keyLower, query),
          scoreText(category, query),
          scoreText(templateId, query),
          scoreText(description, query),
        ) + (version.includes(query) ? 10 : 0);

      return { entry: template, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.entry);
}
