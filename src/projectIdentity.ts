import type {
  ProjectCreationValidationFailure,
  ProjectCreationValidationResult,
  StudioProjectSummary,
} from './projectWorkspaceContracts';

const RESERVED_PROJECT_IDS = ['studio'] as const;

const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/***
 * Normalize a project name into a lowercase hyphenated identifier.
 * @utility @ankhorage/utility/string
 */
export function deriveProjectId(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/***
 * Normalize a human-readable name for case-insensitive equality checks.
 * @utility @ankhorage/utility/string
 */
function normalizeProjectName(projectName: string): string {
  return projectName.trim().replace(/\s+/g, ' ').toLowerCase();
}

/***
 * Test whether a project id is reserved by the Studio workspace.
 * @todo Move project identity/reserved-id policy under src/projects/.
 */
function isReservedProjectId(projectId: string): boolean {
  return RESERVED_PROJECT_IDS.includes(projectId as (typeof RESERVED_PROJECT_IDS)[number]);
}

/*** Represent a failed Studio project-creation validation as an Error carrying its structured reason. */
export class ProjectCreationValidationError extends Error {
  /*** Create an error from one structured project-creation validation failure. */
  constructor(readonly reason: ProjectCreationValidationFailure) {
    super(reason.message);
    this.name = 'ProjectCreationValidationError';
  }
}

/***
 * Validate a new Studio project name and derived id against format, reservation, and uniqueness rules.
 * @todo Move project creation validation under src/projects/.
 */
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
