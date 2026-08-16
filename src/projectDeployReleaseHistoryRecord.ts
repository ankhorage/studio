import type { ProjectReleaseHistoryRecord } from '@ankhorage/deploy/project';

export type ProjectDeployReleaseHistoryRecord = ProjectReleaseHistoryRecord & {
  readonly resumable: boolean;
};
