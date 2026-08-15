import type { AppDeployEnvironmentId } from '@ankhorage/contracts/deploy';
import type {
  ProjectReleaseAndroidContext,
  ProjectReleaseIosContext,
  ProjectReleaseWebContext,
} from '@ankhorage/deploy/project';

export interface ProjectDeployRuntimeInput {
  readonly environment: AppDeployEnvironmentId;
  readonly android?: ProjectReleaseAndroidContext;
  readonly ios?: ProjectReleaseIosContext;
  readonly web?: ProjectReleaseWebContext;
}
