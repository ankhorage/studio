import React from 'react';
import { View } from 'react-native';

import { adminPageStyles, Metric } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeploySummaryGrid({ state }: { readonly state: ProjectDeployDashboardState }) {
  return (
    <View style={adminPageStyles.grid}>
      <Metric title="Enabled targets" value={enabledTargets(state)} />
      <Metric
        title="Listing locales"
        value={readyCount(state.listing, (value) => value.locales.length)}
      />
      <Metric
        title="Products"
        value={readyCount(state.monetization, (value) => value.products.length)}
      />
      <Metric
        title="Prepared release"
        value={state.release.status === 'ready' ? state.release.data.version : 'Not ready'}
      />
    </View>
  );
}

function enabledTargets(state: ProjectDeployDashboardState): string {
  if (state.config.status !== 'ready' || state.config.data === null) return '0';
  const targets = state.config.data.targets;
  return String(
    [targets.web, targets.android, targets.ios].filter((target) => target?.enabled).length,
  );
}

function readyCount<T>(
  value: { readonly status: string; readonly data?: T },
  count: (data: T) => number,
): string {
  return value.status === 'ready' && value.data !== undefined ? String(count(value.data)) : '—';
}
