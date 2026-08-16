import type { ReleaseControlExecutionResult } from '@ankhorage/deploy';
import { Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { KeyValue } from '../../adminPagePrimitives';

export function DeployControlResultView({
  result,
}: {
  readonly result: ReleaseControlExecutionResult;
}) {
  return (
    <View>
      <Text weight="semiBold">Lifecycle control result</Text>
      <KeyValue label="Status" value={result.status} />
      <KeyValue label="Mutation attempted" value={result.mutationAttempted ? 'yes' : 'no'} />
      {'code' in result ? <KeyValue label="Result code" value={result.code} /> : null}
    </View>
  );
}
