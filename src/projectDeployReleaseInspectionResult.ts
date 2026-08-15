import type { DeploymentFailure, ReleasePlan } from '@ankhorage/deploy';
import type { ProjectReleaseInspection } from '@ankhorage/deploy/project';

export type ProjectDeployReleaseInspectionResult =
  | {
      readonly ok: true;
      readonly inspection: ProjectReleaseInspection;
      readonly plan: ReleasePlan;
    }
  | {
      readonly ok: false;
      readonly failure: DeploymentFailure;
    };
