import type { DataSourceDiagnostic } from '@ankhorage/contracts';

export type RuntimeDiagnosticsNoticeColor = 'danger' | 'warning';

export function formatRuntimeDiagnostic(diagnostic: DataSourceDiagnostic): string {
  return `[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`;
}

export function formatRuntimeDiagnostics(diagnostics: readonly DataSourceDiagnostic[]): string {
  return diagnostics.map(formatRuntimeDiagnostic).join('\n');
}

export function resolveRuntimeDiagnosticsNoticeColor(
  diagnostics: readonly DataSourceDiagnostic[],
): RuntimeDiagnosticsNoticeColor {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ? 'danger'
    : 'warning';
}

export function areRuntimeDiagnosticsEqual(
  left: readonly DataSourceDiagnostic[],
  right: readonly DataSourceDiagnostic[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((diagnostic, index) => {
    const other = right[index];
    return (
      diagnostic.code === other?.code &&
      diagnostic.message === other.message &&
      diagnostic.severity === other.severity &&
      diagnostic.dataSourceId === other.dataSourceId &&
      diagnostic.endpointId === other.endpointId &&
      diagnostic.operationId === other.operationId
    );
  });
}
