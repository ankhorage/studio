import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type { MonetizationDesiredState, ReleaseDesiredState } from '@ankhorage/deploy';
import type { ProjectReleaseHistoryRecord, ProjectStoreListing } from '@ankhorage/deploy/project';

export type DeployLoadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly message: string };

export interface ProjectDeployDashboardState {
  readonly config: DeployLoadable<AppDeployManifest | null>;
  readonly listing: DeployLoadable<ProjectStoreListing>;
  readonly monetization: DeployLoadable<MonetizationDesiredState>;
  readonly release: DeployLoadable<ReleaseDesiredState>;
  readonly history: DeployLoadable<readonly ProjectReleaseHistoryRecord[]>;
}
