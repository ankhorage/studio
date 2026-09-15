import { isRecord } from '@ankhorage/utility/object';

import type { ProjectUpdateDashboardState } from '../../../types/project-update-dashboard';

/*** Resolve untrusted structured APM host results into the bounded Dashboard presentation model. */
export function resolveProjectUpdateDashboardPresentation(state: ProjectUpdateDashboardState) {
  return {
    status: resolveStatus(state.status),
    plan: resolvePlan(state.plan),
    execution: resolveExecution(state.execution),
    verification: resolveVerification(state.verification),
  };
}

function resolveStatus(value: unknown) {
  if (!isOperation(value, 'status')) return null;
  const dependencies = readRecords(value.dependencies).map((dependency) => {
    const installed = isRecord(dependency.installed) ? dependency.installed : {};
    const availability = isRecord(dependency.availability) ? dependency.availability : {};
    return {
      name: readString(dependency.name, 'Unknown package'),
      direct: dependency.direct === true,
      currentVersion: readOptionalString(dependency.lockedVersion) ?? readOptionalString(installed.version) ?? 'unknown',
      availableVersion:
        readOptionalString(availability.compatibleVersion) ??
        readOptionalString(availability.latestVersion) ??
        readString(availability.state, 'unknown'),
      findings: readReasonRows(dependency.findings),
    };
  });
  const extensions = isRecord(value.extensions) ? value.extensions : {};
  return {
    complete: value.complete === true,
    currency: readString(value.currency, 'unknown'),
    dependencies,
    observations: readRecords(extensions.observations).map((observation) => ({
      owner: readOptionalString(observation.owner) ?? readOptionalString(observation.packageId) ?? 'Unknown owner',
      projection: readString(observation.projection, 'unknown'),
      migration: readString(observation.migration, 'unknown'),
      reason: readOptionalString(observation.reason),
      nextAction: readOptionalString(observation.nextAction),
    })),
    findings: readReasonRows(value.findings),
    diagnostics: readReasonRows(value.diagnostics),
  };
}

function resolvePlan(value: unknown) {
  if (!isOperation(value, 'plan')) return null;
  const blockers = readRecords(value.blockers).map((blocker) => ({
    code: readString(blocker.code, 'plan.blocked'),
    reason: readString(blocker.reason, 'Plan is blocked.'),
    nextAction: readOptionalString(blocker.nextAction),
  }));
  const steps = readRecords(value.steps).map((step) => ({
    id: readString(step.id, 'step'),
    kind: readString(step.kind, 'unknown'),
    reason: readString(step.reason, 'No reason provided.'),
    evidence: readStrings(step.evidence),
  }));
  const hostRestartRequired =
    blockers.some((blocker) => blocker.code === 'plan.host-upgrade-required') ||
    steps.some((step) => step.kind === 'host-restart');
  const complete = value.complete === true;
  return {
    id: readString(value.id, 'unknown-plan'),
    complete,
    hostRestartRequired,
    canApply: complete && !hostRestartRequired,
    targets: readRecords(value.targets).map((target) => ({
      name: readString(target.name, 'Unknown package'),
      direct: target.direct === true,
      currentVersion: readOptionalString(target.currentVersion) ?? 'unknown',
      targetVersion: readString(target.targetVersion, 'unknown'),
      reason: readString(target.reason, 'No reason provided.'),
    })),
    files: readRecords(value.files).map((file) => ({
      path: readString(file.path, 'unknown path'),
      kind: readString(file.kind, 'update'),
    })),
    steps,
    effects: readRecords(value.effects).map(resolveEffect),
    blockers,
    findings: readReasonRows(value.findings),
    diagnostics: readReasonRows(value.diagnostics),
  };
}

function resolveExecution(value: unknown) {
  if (!isOperation(value, 'apply')) return null;
  const journal = isRecord(value.journal) ? value.journal : {};
  return {
    operationId: readString(value.operationId, ''),
    status: readString(value.status, 'unknown'),
    complete: value.complete === true,
    blockers: readReasonRows(value.blockers),
    diagnostics: readReasonRows(value.diagnostics),
    steps: readRecords(journal.steps).map((step) => ({
      id: readString(step.stepId, 'step'),
      state: readString(step.state, 'unknown'),
      attempts: typeof step.attempts === 'number' ? step.attempts : 0,
    })),
  };
}

function resolveVerification(value: unknown) {
  if (!isOperation(value, 'verify')) return null;
  return {
    operationId: readString(value.operationId, ''),
    verified: value.verified === true,
    checks: readRecords(value.checks).map((check) => ({
      id: readString(check.id, 'check'),
      kind: readString(check.kind, 'unknown'),
      status: readString(check.status, 'unknown'),
      reason: readOptionalString(check.reason),
      nextAction: readOptionalString(check.nextAction),
    })),
    findings: readReasonRows(value.findings),
    followUp: readRecords(value.followUp).map(resolveEffect),
    diagnostics: readReasonRows(value.diagnostics),
  };
}

function resolveEffect(effect: Record<string, unknown>) {
  return {
    kind: readString(effect.kind, 'follow-up'),
    state:
      readOptionalString(effect.requirement) ?? readOptionalString(effect.eligibility) ?? 'unknown',
    reason: readString(effect.reason, 'No reason provided.'),
  };
}

function readReasonRows(value: unknown) {
  return readRecords(value).map((entry) => ({
    code: readOptionalString(entry.code),
    reason: readString(entry.reason, 'No reason provided.'),
    nextAction: readOptionalString(entry.nextAction),
  }));
}

function isOperation(
  value: unknown,
  operation: 'status' | 'plan' | 'apply' | 'verify',
): value is Record<string, unknown> {
  return isRecord(value) && value.operation === operation;
}

function readRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readStrings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
