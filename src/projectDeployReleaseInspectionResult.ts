import type { DeploymentFailure, ReleaseLifecycleControl, ReleasePlan } from '@ankhorage/deploy';
import type { ProjectReleaseInspection } from '@ankhorage/deploy/project';

export type ProjectDeployReleaseInspectionResult =
  | {
      readonly ok: true;
      readonly inspection: ProjectReleaseInspection;
      readonly plan: ReleasePlan;
      readonly lifecycleControls: readonly ReleaseLifecycleControl[];
    }
  | {
      readonly ok: false;
      readonly failure: DeploymentFailure;
    };
