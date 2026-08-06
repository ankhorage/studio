import type { DataSourceDiagnostic } from '@ankhorage/contracts/data';
import { Text } from '@ankhorage/zora';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ExternalApiDiscoveryAttempt } from '../../../externalApiAuthoringContracts';

export function ExternalApiField({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={externalApiAdminStyles.field}>
      <Text variant="bodySmall" weight="semiBold">
        {label}
      </Text>
      {children}
    </View>
  );
}

export function ExternalApiDiagnosticList({
  diagnostics,
  attempts = [],
}: {
  readonly diagnostics: readonly DataSourceDiagnostic[];
  readonly attempts?: readonly ExternalApiDiscoveryAttempt[];
}) {
  if (diagnostics.length === 0 && attempts.length === 0) return null;
  return (
    <View style={externalApiAdminStyles.feedback}>
      {attempts.map((attempt) => (
        <Text key={`${attempt.url}:${attempt.outcome}`} color="neutral" variant="caption">
          {attempt.outcome}: {attempt.url}
          {attempt.status === undefined ? '' : ` (HTTP ${attempt.status})`}
        </Text>
      ))}
      {diagnostics.map((diagnostic, index) => (
        <Text
          key={`${diagnostic.code}:${diagnostic.path ?? index}`}
          color={diagnostic.severity === 'error' ? 'danger' : 'neutral'}
          variant="bodySmall"
        >
          {diagnostic.message}
        </Text>
      ))}
    </View>
  );
}

export const externalApiAdminStyles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    flexGrow: 1,
    gap: 6,
    minWidth: 220,
  },
  feedback: {
    gap: 4,
  },
  operation: {
    gap: 8,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
  },
  stack: {
    gap: 12,
  },
});
