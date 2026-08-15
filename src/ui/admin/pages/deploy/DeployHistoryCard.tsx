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
  if (history.status === 'loading')
    return (
      <Card title="Recent executions">
        <Text>Loading…</Text>
      </Card>
    );
  if (history.status === 'error') {
    return (
      <Card title="Recent executions">
        <Text color="danger">{history.message}</Text>
      </Card>
    );
  }

  const recent = history.data.slice(-5).reverse();
  return (
    <Card title="Recent executions" description="Canonical Deploy release history.">
      {recent.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No release executions recorded yet.
        </Text>
      ) : (
        recent.map((record) => (
          <View key={record.executionId} style={adminPageStyles.row}>
            <KeyValue label={record.desired.version} value={record.result.status} />
            <Text color="neutral" emphasis="muted" variant="caption">
              {record.recordedAt} · {record.executionId}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}
