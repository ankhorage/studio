import type { DeploymentFailure } from '@ankhorage/deploy';
import type {
  ProjectMonetizationInspection,
  ProjectMonetizationPlan,
} from '@ankhorage/deploy/project';

export type ProjectDeployMonetizationInspectionResult =
  | {
      readonly ok: true;
      readonly inspection: ProjectMonetizationInspection;
      readonly plan: ProjectMonetizationPlan;
    }
  | { readonly ok: false; readonly failure: DeploymentFailure };
