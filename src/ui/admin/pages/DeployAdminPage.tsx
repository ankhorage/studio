import { Button, Card, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { DeployAuthoredStateCard } from './deploy/DeployAuthoredStateCard';
import { DeployHistoryCard } from './deploy/DeployHistoryCard';
import { DeployListingLocaleAuthoringCard } from './deploy/DeployListingLocaleAuthoringCard';
import { DeployMonetizationAuthoringCard } from './deploy/DeployMonetizationAuthoringCard';
import { DeployPreparedReleaseAuthoringCard } from './deploy/DeployPreparedReleaseAuthoringCard';
import { DeployReleaseOperationsCard } from './deploy/DeployReleaseOperationsCard';
import { DeployStoreAssetAuthoringCard } from './deploy/DeployStoreAssetAuthoringCard';
import { DeploySummaryGrid } from './deploy/DeploySummaryGrid';
import { DeployTargetsCard } from './deploy/DeployTargetsCard';
import { useProjectDeployDashboard } from './deploy/useProjectDeployDashboard';

export function DeployAdminPage({ projectId }: { readonly projectId: string }) {
  const dashboard = useProjectDeployDashboard(projectId);
  return (
    <AdminScroll>
      <AdminHeader
        title="Deploy"
        description="Deployment administration backed exclusively by @ankhorage/deploy owner APIs."
      />
      <Card compact>
        <View>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            Deployment mutations require a canonical owner plan and explicit Studio confirmation.
          </Text>
          <Button variant="outline" onPress={dashboard.refresh}>
            Refresh owner state
          </Button>
        </View>
      </Card>
      <DeploySummaryGrid state={dashboard.state} />
      <DeployTargetsCard config={dashboard.state.config} />
      <DeployAuthoredStateCard state={dashboard.state} />
      <DeployListingLocaleAuthoringCard
        projectId={projectId}
        listing={dashboard.state.listing}
        onMutation={dashboard.refresh}
      />
      <DeployStoreAssetAuthoringCard
        projectId={projectId}
        listing={dashboard.state.listing}
        onMutation={dashboard.refresh}
      />
      <DeployMonetizationAuthoringCard
        projectId={projectId}
        monetization={dashboard.state.monetization}
        onMutation={dashboard.refresh}
      />
      <DeployPreparedReleaseAuthoringCard
        projectId={projectId}
        release={dashboard.state.release}
        onMutation={dashboard.refresh}
      />
      <DeployReleaseOperationsCard
        projectId={projectId}
        release={dashboard.state.release}
        history={dashboard.state.history}
        onMutation={dashboard.refresh}
      />
      <DeployHistoryCard history={dashboard.state.history} />
    </AdminScroll>
  );
}
