import { Card } from '@ankhorage/zora';
import React from 'react';

import { KeyValue } from '../../adminPagePrimitives';
import type { DeployLoadable, ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployAuthoredStateCard({
  state,
}: {
  readonly state: ProjectDeployDashboardState;
}) {
  return (
    <Card
      title="Authored Deploy state"
      description="Read directly through @ankhorage/deploy owner APIs; Studio does not read Deploy files."
    >
      <KeyValue label="Store listing" value={listingValue(state.listing)} />
      <KeyValue label="Listing revision" value={revisionValue(state.listing)} />
      <KeyValue label="Monetization" value={monetizationValue(state.monetization)} />
      <KeyValue label="Monetization revision" value={revisionValue(state.monetization)} />
      <KeyValue label="Prepared release" value={releaseValue(state.release)} />
      <KeyValue label="Release revision" value={revisionValue(state.release)} />
    </Card>
  );
}

function listingValue(value: ProjectDeployDashboardState['listing']): string {
  if (value.status !== 'ready') return statusValue(value);
  const assets = value.data.assetSets.reduce((count, set) => count + set.assets.length, 0);
  return `${value.data.locales.length} locale(s) · ${assets} asset(s)`;
}

function monetizationValue(value: ProjectDeployDashboardState['monetization']): string {
  return value.status === 'ready' ? `${value.data.products.length} product(s)` : statusValue(value);
}

function releaseValue(value: ProjectDeployDashboardState['release']): string {
  return value.status === 'ready'
    ? `${value.data.version} · ${value.data.targets.join(', ')}`
    : statusValue(value);
}

function revisionValue(value: DeployLoadable<{ readonly revision: string }>): string {
  return value.status === 'ready' ? shortRevision(value.data.revision) : statusValue(value);
}

function statusValue(value: DeployLoadable<unknown>): string {
  if (value.status === 'loading') return 'Loading…';
  if (value.status === 'error') return `Unavailable · ${value.message}`;
  return 'Ready';
}

function shortRevision(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}
