import type { ProjectReleaseExecutionResult } from '@ankhorage/deploy/project';

export interface ProjectDeployReleaseExecutionResponse {
  readonly executionId: string;
  readonly result: ProjectReleaseExecutionResult;
}
