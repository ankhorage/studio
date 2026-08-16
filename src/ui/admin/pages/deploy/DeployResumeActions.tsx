import { isReleaseStepResumable } from '@ankhorage/deploy';
import { Button, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployResumeActions(props: {
  readonly history: ProjectDeployDashboardState['history'];
  readonly disabled: boolean;
  readonly onResume: (executionId: string) => void;
}) {
  if (props.history.status !== 'ready') return null;
  const records = props.history.data.filter((record) =>
    record.execution.steps.some(isReleaseStepResumable),
  );
  if (records.length === 0) return null;
  return (
    <View>
      <Text weight="semiBold">Resumable executions</Text>
      {records.map((record) => (
        <View key={record.executionId}>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {record.desired.version} · {record.result.status} · {record.executionId}
          </Text>
          <Button
            disabled={props.disabled}
            variant="outline"
            onPress={() => props.onResume(record.executionId)}
          >
            Resume execution
          </Button>
        </View>
      ))}
    </View>
  );
}
