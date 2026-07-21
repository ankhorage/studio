import type {
  ProjectCreationValidationFailure,
  ProjectCreationValidationResult,
  StudioProjectSummary,
} from './projectWorkspaceContracts';

const RESERVED_PROJECT_IDS = ['studio'] as const;

const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function deriveProjectId(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeProjectName(projectName: string): string {
  return projectName.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isReservedProjectId(projectId: string): boolean {
  return RESERVED_PROJECT_IDS.includes(projectId as (typeof RESERVED_PROJECT_IDS)[number]);
}

export class ProjectCreationValidationError extends Error {
  constructor(readonly reason: ProjectCreationValidationFailure) {
    super(reason.message);
    this.name = 'ProjectCreationValidationError';
  }
}

export function validateProjectCreationInput(args: {
  name: string;
  existingProjects: readonly StudioProjectSummary[];
}): ProjectCreationValidationResult {
  const normalizedName = normalizeProjectName(args.name);
  const projectId = deriveProjectId(args.name);

  if (!normalizedName) {
    return {
      ok: false,
      projectId,
      reason: { code: 'empty-name', message: 'Project name is required.' },
    };
  }

  if (!PROJECT_ID_PATTERN.test(projectId)) {
    return {
      ok: false,
      projectId,
      reason: {
        code: 'invalid-project-id',
        message: 'Project ID must contain lowercase letters, numbers, and hyphens.',
      },
    };
  }

  if (isReservedProjectId(projectId)) {
    return {
      ok: false,
      projectId,
      reason: {
        code: 'reserved-project-id',
        message: `'${projectId}' is reserved for the Studio workspace app.`,
      },
    };
  }

  if (args.existingProjects.some((project) => project.id === projectId)) {
    return {
      ok: false,
      projectId,
      reason: { code: 'project-id-exists', message: `Project ID '${projectId}' already exists.` },
    };
  }

  if (
    args.existingProjects.some((project) => normalizeProjectName(project.name) === normalizedName)
  ) {
    return {
      ok: false,
      projectId,
      reason: {
        code: 'project-name-exists',
        message: `Project name '${args.name.trim()}' already exists.`,
      },
    };
  }

  return { ok: true, projectId };
}
