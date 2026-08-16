import { Card, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { adminPageStyles, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployHistoryCard({
  history,
}: {
  readonly history: ProjectDeployDashboardState['history'];
}) {
  if (history.status === 'loading') {
    return (
      <Card title="Recent executions">
        <Text>Loading…</Text>
      </Card>
    );
  }
  if (history.status === 'error') {
    return (
      <Card title="Recent executions">
        <Text color="danger">{history.message}</Text>
      </Card>
    );
  }

  const recent = history.data.slice(-10).reverse();
  return (
    <Card
      title="Recent executions"
      description="Immutable Deploy release history with owner revisions, attempted/executed steps, and verification result state."
    >
      {recent.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No release executions recorded yet.
        </Text>
      ) : (
        recent.map((record) => (
          <View key={record.executionId} style={adminPageStyles.row}>
            <KeyValue label={record.desired.version} value={record.result.status} />
            <KeyValue label="Execution id" value={record.executionId} />
            <KeyValue label="Recorded" value={record.recordedAt} />
            <KeyValue label="Desired revision" value={record.initialPlan.desiredRevision} />
            <KeyValue label="Initial current revision" value={record.initialPlan.currentRevision} />
            <KeyValue label="Result current revision" value={record.result.currentRevision} />
            <KeyValue label="Execution release revision" value={record.execution.releaseRevision} />
            <KeyValue
              label="Executed steps"
              value={
                record.result.executedStepIds.length === 0
                  ? 'none'
                  : record.result.executedStepIds.join(', ')
              }
            />
            {record.result.attemptedStepId ? (
              <KeyValue label="Attempted step" value={record.result.attemptedStepId} />
            ) : null}
            {record.result.code ? (
              <KeyValue label="Result code" value={record.result.code} />
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}
