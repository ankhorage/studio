import { Button, Card, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { DeployAuthoredStateCard } from './deploy/DeployAuthoredStateCard';
import { DeployHistoryCard } from './deploy/DeployHistoryCard';
import { DeployReadinessCard } from './deploy/DeployReadinessCard';
import { DeploySummaryGrid } from './deploy/DeploySummaryGrid';
import { DeployTargetsCard } from './deploy/DeployTargetsCard';
import { useProjectDeployDashboard } from './deploy/useProjectDeployDashboard';

export function DeployAdminPage({ projectId }: { readonly projectId: string }) {
  const dashboard = useProjectDeployDashboard(projectId);

  return (
    <AdminScroll>
      <AdminHeader
        title="Deploy"
        description="Deployment configuration and readiness, backed exclusively by @ankhorage/deploy."
      />
      <Card compact>
        <View>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            This phase is read-only. Readiness inspection never executes a deployment.
          </Text>
          <Button variant="outline" onPress={dashboard.refresh}>
            Refresh owner state
          </Button>
        </View>
      </Card>
      <DeploySummaryGrid state={dashboard.state} />
      <DeployTargetsCard config={dashboard.state.config} />
      <DeployAuthoredStateCard state={dashboard.state} />
      <DeployReadinessCard projectId={projectId} release={dashboard.state.release} />
      <DeployHistoryCard history={dashboard.state.history} />
    </AdminScroll>
  );
}
