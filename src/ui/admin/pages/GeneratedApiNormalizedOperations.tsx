import type { GeneratedRestApiDataSourceConfig } from '@ankhorage/contracts';
import { Text } from '@ankhorage/zora';
import { View } from 'react-native';

import { collectDataSourceOperationRows } from './adminDataSourceOperations';
import { generatedApiEditorStyles } from './generatedApiEditorStyles';

export function GeneratedApiNormalizedOperations({
  dataSource,
}: {
  readonly dataSource?: GeneratedRestApiDataSourceConfig;
}) {
  if (!dataSource) return null;
  const rows = collectDataSourceOperationRows({ [dataSource.id]: dataSource });
  return (
    <View style={generatedApiEditorStyles.stack}>
      <Text variant="bodySmall" weight="semiBold">
        Normalized operations
      </Text>
      {rows.map((row) => (
        <Text key={`${row.endpointId}:${row.operationId}`} color="neutral" variant="caption">
          {row.operationId} · {row.protocol} · {row.kind} · {row.path ?? '—'}
        </Text>
      ))}
    </View>
  );
}
