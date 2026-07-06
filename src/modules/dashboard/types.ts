export interface TemplateSummary {
  id: string;
  category: string;
  templateId: string;
  name: string;
  description: string;
  version: string;
}

export type TemplateEntry = TemplateSummary;

export interface ProjectItem {
  id: string;
  name: string;
  version: string;
}
