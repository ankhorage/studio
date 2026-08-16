import type { ProjectMonetizationExecutionResult } from '@ankhorage/deploy/project';
import { Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { KeyValue } from '../../adminPagePrimitives';

export function DeployMonetizationExecutionView({
  result,
}: {
  readonly result: ProjectMonetizationExecutionResult;
}) {
  if (result.status === 'failed') {
    return (
      <View>
        <Text weight="semiBold">Monetization synchronization failed</Text>
        <Text color="danger">{result.failure.code}</Text>
        <Text color="danger">{result.failure.message}</Text>
      </View>
    );
  }
  if (result.status === 'action-required') {
    return (
      <View>
        <Text weight="semiBold">Monetization synchronization requires action</Text>
        {result.actions.map((action) => (
          <Text key={`${action.type}:${action.code}`} color="danger" variant="bodySmall">
            {action.code}: {action.message}
          </Text>
        ))}
      </View>
    );
  }
  return (
    <View>
      <Text weight="semiBold">Monetization synchronization completed</Text>
      <KeyValue label="Verified current revision" value={result.inspection.currentRevision} />
      <KeyValue label="Verification plan" value={result.plan.status} />
    </View>
  );
}
