import type { DataSourceDiagnostic } from '@ankhorage/contracts';

export type RuntimeDiagnosticsNoticeColor = 'danger' | 'warning';

/***
 * Format a code/message/severity diagnostic as one compact display line.
 * @utility @ankhorage/utility/diagnostics
 */
export function formatRuntimeDiagnostic(diagnostic: DataSourceDiagnostic): string {
  return `[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`;
}

/***
 * Format multiple diagnostics as newline-separated display text.
 * @utility @ankhorage/utility/diagnostics
 */
export function formatRuntimeDiagnostics(diagnostics: readonly DataSourceDiagnostic[]): string {
  return diagnostics.map(formatRuntimeDiagnostic).join('\n');
}

/***
 * Choose the Studio notice color for a diagnostics collection based on whether any error exists.
 * @todo Move Studio diagnostics presentation policy under src/diagnostics/.
 */
export function resolveRuntimeDiagnosticsNoticeColor(
  diagnostics: readonly DataSourceDiagnostic[],
): RuntimeDiagnosticsNoticeColor {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error') ? 'danger' : 'warning';
}

/***
 * Compare two ordered diagnostics arrays by the fields that define Studio runtime diagnostic identity.
 * @utility @ankhorage/utility/array
 */
export function areRuntimeDiagnosticsEqual(
  left: readonly DataSourceDiagnostic[],
  right: readonly DataSourceDiagnostic[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((diagnostic, index) => {
    const other = right.at(index);
    if (!other) return false;

    return (
      diagnostic.code === other.code &&
      diagnostic.message === other.message &&
      diagnostic.severity === other.severity &&
      diagnostic.dataSourceId === other.dataSourceId &&
      diagnostic.endpointId === other.endpointId &&
      diagnostic.operationId === other.operationId
    );
  });
}
