import type { AppEnvironmentId } from '@ankhorage/contracts/environments';
import type {
  ProjectReleaseAndroidContext,
  ProjectReleaseIosContext,
  ProjectReleaseWebContext,
} from '@ankhorage/deploy/project';

export interface ProjectDeployRuntimeInput {
  readonly environment: AppEnvironmentId;
  readonly android?: ProjectReleaseAndroidContext;
  readonly ios?: ProjectReleaseIosContext;
  readonly web?: ProjectReleaseWebContext;
}
