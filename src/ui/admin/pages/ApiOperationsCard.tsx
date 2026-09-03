import type { ApiDefinitionList } from '@ankhorage/contracts/data';
import { Button, Card, Text } from '@ankhorage/zora';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { testExternalApiOperation } from '../../../externalApiApi';
import type { ExternalApiOperationTestResult } from '../../../externalApiAuthoringContracts';
import { type ApiOperationRow, collectApiOperationRows } from './adminApiOperations';
import { ExternalApiDiagnosticList, externalApiAdminStyles } from './ExternalApiAdminPrimitives';

/*** Render canonical API operations and execute/dry-run external operations against the active Studio project. */
export function ApiOperationsCard({ apis }: { readonly apis: ApiDefinitionList }) {
  const studio = useStudio();
  const rows = useMemo(() => collectApiOperationRows(apis), [apis]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExternalApiOperationTestResult>>({});

  /*** Execute or dry-run one external API operation and store its result under the operation's stable UI key. */
  const run = useCallback(
    async (row: ApiOperationRow, dryRun: boolean) => {
      const key = operationKey(row);
      setBusyKey(key);
      try {
        const result = await testExternalApiOperation(studio.projectId, {
          apiId: row.apiId,
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
          No API operations are configured.
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
                  {row.apiId} / {row.endpointId} · {row.method ?? row.protocol} {row.path ?? ''} ·{' '}
                  {row.intent}
                </Text>
                {row.testable ? (
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
                ) : (
                  <Text color="neutral" variant="caption">
                    Internal API execution is not available in Phase 1.
                  </Text>
                )}
                {result ? <OperationResult result={result} /> : null}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

/*** Render request/response/data diagnostics for one external API operation execution result. */
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

/***
 * Build a stable composite key from the identifying fields of an API operation row.
 * @utility @ankhorage/utility/string
 */
function operationKey(row: ApiOperationRow): string {
  return `${row.apiId}:${row.endpointId}:${row.operationId}`;
}

/***
 * Pretty-serialize a JSON-compatible value and truncate the resulting text to a configured display budget.
 * @utility @ankhorage/utility/json
 */
function formatData(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length > 1_500 ? `${serialized.slice(0, 1_500)}…` : serialized;
}
