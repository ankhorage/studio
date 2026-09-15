import type { ApmApplyPermissions, ApmPlanPolicyInput, ApmStatusAvailabilityMode } from '@ankhorage/apm/types';

import type { ProjectUpdateHostPort } from './ports/outbound/ProjectUpdateHostPort';

/*** Coordinate Dashboard APM lifecycle requests through the authorized project-scoped host port. */
export class ProjectUpdateDashboardService {
  /*** Bind Dashboard lifecycle orchestration to one project-update host capability. */
  constructor(private readonly host: ProjectUpdateHostPort) {}

  /*** Inspect fresh or offline APM evidence for one selected Studio project. */
  async inspectAsync(projectId: string, availability: ApmStatusAvailabilityMode): Promise<unknown> {
    return await this.host.statusAsync(requireProjectId(projectId), availability);
  }

  /*** Build a concrete safe-update/repair plan for one selected Studio project. */
  async planAsync(projectId: string, availability: ApmStatusAvailabilityMode): Promise<unknown> {
    return await this.host.planAsync(requireProjectId(projectId), {
      availability,
      policy: DASHBOARD_PLAN_POLICY,
    });
  }

  /*** Execute one explicitly reviewed plan using the user's explicit permission envelope. */
  async applyAsync(
    projectId: string,
    plan: unknown,
    permissions: ApmApplyPermissions,
  ): Promise<unknown> {
    return await this.host.applyAsync(requireProjectId(projectId), plan, permissions);
  }

  /*** Resume one durable APM operation for the selected project. */
  async resumeAsync(
    projectId: string,
    operationId: string,
    permissions: ApmApplyPermissions,
  ): Promise<unknown> {
    return await this.host.resumeAsync(
      requireProjectId(projectId),
      requireOperationId(operationId),
      permissions,
    );
  }

  /*** Verify one durable APM operation against fresh owner-aware evidence. */
  async verifyAsync(projectId: string, operationId: string): Promise<unknown> {
    return await this.host.verifyAsync(requireProjectId(projectId), requireOperationId(operationId));
  }
}

const DASHBOARD_PLAN_POLICY: ApmPlanPolicyInput = {
  dependencyUpdates: 'safe',
  repairInstallations: true,
  repairProjections: true,
};

/*** Reject an empty project identity before invoking the host boundary. */
function requireProjectId(projectId: string): string {
  const value = projectId.trim();
  if (value.length === 0) throw new Error('A selected project is required.');
  return value;
}

/*** Reject an empty durable operation identity before resume or verification. */
function requireOperationId(operationId: string): string {
  const value = operationId.trim();
  if (value.length === 0) throw new Error('An APM operation ID is required.');
  return value;
}
