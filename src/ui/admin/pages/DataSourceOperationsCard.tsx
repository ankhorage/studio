import type { DataSourceRegistry } from '@ankhorage/contracts/data';
import { Button, Card, Text } from '@ankhorage/zora';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { testExternalApiOperation } from '../../../externalApiApi';
import type { ExternalApiOperationTestResult } from '../../../externalApiAuthoringContracts';
import { useStudio } from '../../../core/StudioContext';
import {
  collectDataSourceOperationRows,
  type DataSourceOperationRow,
} from './adminDataSourceOperations';
import { ExternalApiDiagnosticList, externalApiAdminStyles } from './ExternalApiAdminPrimitives';

export function DataSourceOperationsCard({
  dataSources,
}: {
  readonly dataSources: DataSourceRegistry;
}) {
  const studio = useStudio();
  const rows = useMemo(() => collectDataSourceOperationRows(dataSources), [dataSources]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExternalApiOperationTestResult>>({});

  const run = useCallback(
    async (row: DataSourceOperationRow, dryRun: boolean) => {
      const key = operationKey(row);
      setBusyKey(key);
      try {
        const result = await testExternalApiOperation(studio.projectId, {
          sourceId: row.sourceId,
          endpointId: row.endpointId,
          operationId: row.operationId,
          dryRun,
        });
        setResults((current) => ({ ...current, [key]: result }));
      } finally {
        setBusyKey(null);
      }
    },
    [studio.projectId],
  );

  return (
    <Card title="Operations">
      {rows.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No runtime operations are configured.
        </Text>
      ) : (
        <View style={externalApiAdminStyles.stack}>
          {rows.map((row) => {
            const key = operationKey(row);
            const result = results[key];
            return (
              <View key={key} style={externalApiAdminStyles.operation}>
                <Text weight="semiBold">{row.name ?? row.operationId}</Text>
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {row.sourceId} / {row.endpointId} · {row.method ?? row.protocol ?? 'operation'}{' '}
                  {row.path ?? ''} · {row.kind}
                </Text>
                <View style={externalApiAdminStyles.actions}>
                  <Button
                    variant="outline"
                    loading={busyKey === key}
                    onPress={() => void run(row, true)}
                  >
                    Dry run
                  </Button>
                  <Button loading={busyKey === key} onPress={() => void run(row, false)}>
                    Execute
                  </Button>
                </View>
                {result ? <OperationResult result={result} /> : null}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function OperationResult({ result }: { readonly result: ExternalApiOperationTestResult }) {
  return (
    <View style={externalApiAdminStyles.feedback}>
      {result.request ? (
        <Text variant="caption">
          {result.request.dryRun ? 'Prepared' : 'Sent'} {result.request.method} {result.request.url}
        </Text>
      ) : null}
      {result.response ? (
        <Text variant="caption">
          HTTP {result.response.status} · {result.response.ok ? 'success' : 'failure'}
        </Text>
      ) : null}
      {result.ok && result.data !== undefined ? (
        <Text selectable variant="caption">
          {formatData(result.data)}
        </Text>
      ) : null}
      <ExternalApiDiagnosticList diagnostics={result.diagnostics} />
    </View>
  );
}

function operationKey(row: DataSourceOperationRow): string {
  return `${row.sourceId}:${row.endpointId}:${row.operationId}`;
}

function formatData(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length > 1_500 ? `${serialized.slice(0, 1_500)}…` : serialized;
}
