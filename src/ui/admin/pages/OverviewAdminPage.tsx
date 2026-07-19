import { Card } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import {
  AdminHeader,
  adminPageStyles,
  AdminScroll,
  KeyValue,
  Metric,
} from '../adminPagePrimitives';

export function OverviewAdminPage() {
  const studio = useStudio();
  const manifest = studio.manifest;
  const routes = manifest?.navigator.routes.length ?? 0;
  const screens = manifest ? Object.keys(manifest.screens).length : 0;
  const dataSources = manifest?.dataSources ? Object.keys(manifest.dataSources).length : 0;
  const authScope = manifest?.infra.auth?.scope ?? 'none';

  return (
    <AdminScroll>
      <AdminHeader
        title="Project overview"
        description="Current generated app administration status and quick access."
      />
      <View style={adminPageStyles.grid}>
        <Metric title="Project" value={manifest?.metadata.name ?? studio.projectId} />
        <Metric title="Routes" value={String(routes)} />
        <Metric title="Screens" value={String(screens)} />
        <Metric title="Data sources" value={String(dataSources)} />
      </View>
      <Card title="Administration status">
        <KeyValue label="Project ID" value={studio.projectId} />
        <KeyValue label="Auth scope" value={authScope} />
        <KeyValue label="Active theme" value={manifest?.activeThemeId ?? 'none'} />
      </Card>
    </AdminScroll>
  );
}
