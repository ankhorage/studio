import {
  applyProjectAsync,
  planProjectAsync,
  statusProjectAsync,
  verifyProjectAsync,
} from '@ankhorage/apm/node';
import type {
  ApmApplyInput,
  ApmApplyResult,
  ApmPlanProjectInput,
  ApmPlanResult,
  ApmProjectStatusPort,
  ApmStatusHostPackage,
  ApmStatusInput,
  ApmStatusResult,
  ApmVerifyInput,
  ApmVerifyResult,
} from '@ankhorage/apm/types';

import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';

const STUDIO_HOST_ID = 'studio';
const STUDIO_PACKAGE_NAME = '@ankhorage/studio';

/*** Compose Studio's project update lifecycle through the released APM Node use cases. */
export class ProjectUpdateService {
  private readonly options: ProjectUpdateServiceOptions;
  private readonly runningStudioVersion: string | undefined;
  private readonly statusPort: ApmProjectStatusPort;

  /*** Create one Studio update service with optional package-owned ports and exact running owner identity. */
  constructor(options: ProjectUpdateServiceOptions = {}, runningStudioVersion?: string) {
    this.options = options;
    this.runningStudioVersion = runningStudioVersion;
    this.statusPort = {
      inspectStatusAsync: (input) =>
        statusProjectAsync(withStudioHostPackage(input, runningStudioVersion), {
          ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
        }),
    };
  }

  /*** Inspect dependency/update evidence without mutating the project. */
  async statusAsync(input: ApmStatusInput): Promise<ApmStatusResult> {
    const status = await this.statusPort.inspectStatusAsync(input);
    return {
      ...status,
      findings: uniquePresentationRows(status.findings),
      diagnostics: uniquePresentationRows(status.diagnostics),
    };
  }

  /*** Produce one reviewable APM plan using Studio-owned protocol evidence when available. */
  async planAsync(input: ApmPlanProjectInput): Promise<ApmPlanResult> {
    return planProjectAsync(input, {
      status: this.statusPort,
      ...(this.options.protocol === undefined ? {} : { protocol: this.options.protocol }),
    });
  }

  /*** Start or resume one durable APM operation using Studio-owned execution adapters when required. */
  async applyAsync(input: ApmApplyInput): Promise<ApmApplyResult> {
    return applyProjectAsync(input, {
      status: this.statusPort,
      ...(this.options.applyOwnerStep === undefined
        ? {}
        : { ownerStep: this.options.applyOwnerStep }),
      ...(this.options.progress === undefined ? {} : { progress: this.options.progress }),
      ...(this.options.cancellation === undefined
        ? {}
        : { cancellation: this.options.cancellation }),
    });
  }

  /*** Verify one completed APM operation against fresh project and package-owned postconditions. */
  async verifyAsync(input: ApmVerifyInput): Promise<ApmVerifyResult> {
    return verifyProjectAsync(input, {
      status: this.statusPort,
      ...(this.options.verifyOwnerStep === undefined
        ? {}
        : { ownerStep: this.options.verifyOwnerStep }),
    });
  }
}

/*** Add the exact running Studio artifact to APM's separate host-package evidence channel. */
function withStudioHostPackage(
  input: ApmStatusInput,
  runningStudioVersion: string | undefined,
): ApmStatusInput {
  if (runningStudioVersion === undefined) return input;
  const studioHost: ApmStatusHostPackage = {
    id: STUDIO_HOST_ID,
    name: STUDIO_PACKAGE_NAME,
    version: runningStudioVersion,
  };
  return {
    ...input,
    hostPackages: [
      ...(input.hostPackages ?? []).filter(({ id }) => id !== STUDIO_HOST_ID),
      studioHost,
    ],
  };
}

/*** Collapse top-level status rows that Studio renders identically while retaining raw scoped APM evidence for planning. */
function uniquePresentationRows<T extends StatusPresentationRow>(rows: readonly T[]): readonly T[] {
  return rows.filter(
    (row, index, allRows) =>
      allRows.findIndex(
        (candidate) =>
          candidate.code === row.code &&
          candidate.reason === row.reason &&
          candidate.nextAction === row.nextAction,
      ) === index,
  );
}

interface StatusPresentationRow {
  readonly code: string;
  readonly reason: string;
  readonly nextAction?: string;
}
