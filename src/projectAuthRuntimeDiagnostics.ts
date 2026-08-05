import type {
  ProjectAuthDiagnostic,
  ProjectAuthDiagnosticSeverity,
  ProjectAuthHealth,
  ProjectAuthHealthStatus,
} from './projectAuthHealth';

export type ProjectAuthRuntimeRolloutStatus =
  | 'ready'
  | 'not-ready'
  | 'unavailable'
  | 'not-generated';

export interface ProjectAuthRuntimeDiagnostics {
  readonly providerRedirectUrl?: string;
  readonly appCallbackTargets: readonly string[];
  readonly redirectAllowList: readonly string[];
  readonly rolloutStatus: ProjectAuthRuntimeRolloutStatus;
  readonly diagnostics?: readonly ProjectAuthDiagnostic[];
}

export function applyProjectAuthRuntimeDiagnostics(
  health: ProjectAuthHealth,
  runtime: ProjectAuthRuntimeDiagnostics,
): ProjectAuthHealth {
  const diagnostics = [
    ...health.diagnostics,
    ...runtime.appCallbackTargets.map((target, index) => ({
      code: 'app_callback_target',
      severity: 'info' as const,
      message: `Enabled app callback target: ${target}`,
      path: `infra.auth.oauth.callbackTargets[${index}]`,
    })),
    ...runtime.redirectAllowList.map((target, index) => ({
      code: 'redirect_allow_list_entry',
      severity: 'info' as const,
      message: `Auth redirect allowlist entry: ${target}`,
      path: `infra.auth.oauth.redirectAllowList[${index}]`,
    })),
    resolveRolloutDiagnostic(runtime.rolloutStatus),
    ...(runtime.diagnostics ?? []),
  ];
  const sortedDiagnostics = sortDiagnostics(uniqueDiagnostics(diagnostics));

  return {
    ...health,
    status: resolveHealthStatus(sortedDiagnostics),
    diagnostics: sortedDiagnostics,
    callbackUrls: {
      ...health.callbackUrls,
      ...(runtime.providerRedirectUrl
        ? { providerRedirectUrl: runtime.providerRedirectUrl }
        : {}),
    },
  };
}

function resolveRolloutDiagnostic(
  status: ProjectAuthRuntimeRolloutStatus,
): ProjectAuthDiagnostic {
  switch (status) {
    case 'ready':
      return {
        code: 'auth_runtime_ready',
        severity: 'info',
        message: 'The running Auth deployment reports ready.',
        path: 'infra.auth.runtime',
      };
    case 'not-ready':
      return {
        code: 'auth_runtime_not_ready',
        severity: 'error',
        message: 'The running Auth deployment is not ready.',
        path: 'infra.auth.runtime',
      };
    case 'not-generated':
      return {
        code: 'auth_runtime_not_generated',
        severity: 'warning',
        message: 'Auth runtime diagnostics are unavailable until infrastructure is generated.',
        path: 'infra.auth.runtime',
      };
    case 'unavailable':
      return {
        code: 'auth_runtime_unavailable',
        severity: 'warning',
        message: 'The generated infrastructure could not report Auth runtime readiness.',
        path: 'infra.auth.runtime',
      };
  }
}

function resolveHealthStatus(
  diagnostics: readonly ProjectAuthDiagnostic[],
): ProjectAuthHealthStatus {
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return 'error';
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) return 'warning';
  return 'healthy';
}

function sortDiagnostics(
  diagnostics: readonly ProjectAuthDiagnostic[],
): readonly ProjectAuthDiagnostic[] {
  const severityRank: Record<ProjectAuthDiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return [...diagnostics].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.code.localeCompare(right.code) ||
      (left.path ?? '').localeCompare(right.path ?? '') ||
      (left.providerId ?? '').localeCompare(right.providerId ?? ''),
  );
}

function uniqueDiagnostics(
  diagnostics: readonly ProjectAuthDiagnostic[],
): readonly ProjectAuthDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.severity,
      diagnostic.message,
      diagnostic.path ?? '',
      diagnostic.providerId ?? '',
      diagnostic.credentialsRef ?? '',
    ].join('\u0000');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
