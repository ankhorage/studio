import { slugifyAscii } from '@ankhorage/utility/string';

import {
  STUDIO_PROJECT_ID_PATTERN,
  STUDIO_RESERVED_PROJECT_IDS,
} from './constants/projectIdentity';
import type {
  ProjectCreationValidationFailure,
  ProjectCreationValidationResult,
  StudioProjectSummary,
} from './projectWorkspaceContracts';

/***
 * Normalize a project name into a lowercase hyphenated identifier.
 */
export function deriveProjectId(projectName: string): string {
  return slugifyAscii(projectName);
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
  return STUDIO_RESERVED_PROJECT_IDS.has(projectId);
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

  if (!STUDIO_PROJECT_ID_PATTERN.test(projectId)) {
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
