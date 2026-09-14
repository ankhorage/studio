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
  ApmStatusInput,
  ApmStatusResult,
  ApmVerifyInput,
  ApmVerifyResult,
} from '@ankhorage/apm/types';

import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';

/*** Compose Studio's project update lifecycle through the released APM Node use cases. */
export class ProjectUpdateService {
  private readonly options: ProjectUpdateServiceOptions;
  private readonly statusPort: ApmProjectStatusPort;

  /*** Create one Studio update service with optional package-owned protocol and execution ports. */
  constructor(options: ProjectUpdateServiceOptions = {}) {
    this.options = options;
    this.statusPort = {
      inspectStatusAsync: (input) =>
        statusProjectAsync(input, {
          ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
        }),
    };
  }

  /*** Inspect dependency/update evidence without mutating the project. */
  async statusAsync(input: ApmStatusInput): Promise<ApmStatusResult> {
    return this.statusPort.inspectStatusAsync(input);
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
