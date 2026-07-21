import { deriveProjectId, validateProjectCreationInput } from '../../projectIdentity';
import type {
  ProjectCreationValidationResult,
  StudioProjectSummary,
} from '../../projectWorkspaceContracts';

export interface CreateProjectFormState {
  derivedProjectId: string;
  validation: ProjectCreationValidationResult | null;
  canCreate: boolean;
  projectListState: 'loading' | 'error' | 'ready';
}

export function resolveCreateProjectFormState(args: {
  projectName: string;
  existingProjects: readonly StudioProjectSummary[];
  projectsLoading: boolean;
  projectsError: string | null;
  templateAvailable: boolean;
  isCreating: boolean;
}): CreateProjectFormState {
  const derivedProjectId = deriveProjectId(args.projectName);
  const projectListState = args.projectsLoading
    ? 'loading'
    : args.projectsError
      ? 'error'
      : 'ready';
  const validation =
    projectListState === 'ready'
      ? validateProjectCreationInput({
          name: args.projectName,
          existingProjects: args.existingProjects,
        })
      : null;

  return {
    derivedProjectId,
    validation,
    projectListState,
    canCreate: args.templateAvailable && validation?.ok === true && !args.isCreating,
  };
}
