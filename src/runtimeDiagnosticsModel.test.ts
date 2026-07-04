import type { DataSourceDiagnostic } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  areRuntimeDiagnosticsEqual,
  formatRuntimeDiagnostic,
  formatRuntimeDiagnostics,
  resolveRuntimeDiagnosticsNoticeColor,
} from './runtimeDiagnosticsModel';

const WARNING_DIAGNOSTIC: DataSourceDiagnostic = {
  severity: 'warning',
  code: 'missing-binding',
  message: 'Missing binding.',
  dataSourceId: 'source',
  endpointId: 'endpoint',
  operationId: 'operation',
};

const ERROR_DIAGNOSTIC: DataSourceDiagnostic = {
  severity: 'error',
  code: 'failed-binding',
  message: 'Binding failed.',
  dataSourceId: 'source',
  endpointId: 'endpoint',
  operationId: 'operation',
};

describe('runtimeDiagnosticsModel', () => {
  test('formats diagnostics', () => {
    expect(formatRuntimeDiagnostic(WARNING_DIAGNOSTIC)).toBe(
      '[warning] missing-binding: Missing binding.',
    );
    expect(formatRuntimeDiagnostics([WARNING_DIAGNOSTIC, ERROR_DIAGNOSTIC])).toBe(
      '[warning] missing-binding: Missing binding.\n[error] failed-binding: Binding failed.',
    );
  });

  test('resolves notice color from severity', () => {
    expect(resolveRuntimeDiagnosticsNoticeColor([WARNING_DIAGNOSTIC])).toBe('warning');
    expect(resolveRuntimeDiagnosticsNoticeColor([WARNING_DIAGNOSTIC, ERROR_DIAGNOSTIC])).toBe(
      'danger',
    );
  });

  test('compares diagnostics by stable fields', () => {
    expect(areRuntimeDiagnosticsEqual([WARNING_DIAGNOSTIC], [{ ...WARNING_DIAGNOSTIC }])).toBe(
      true,
    );
    expect(areRuntimeDiagnosticsEqual([WARNING_DIAGNOSTIC], [ERROR_DIAGNOSTIC])).toBe(false);
    expect(areRuntimeDiagnosticsEqual([WARNING_DIAGNOSTIC], [])).toBe(false);
  });
});
