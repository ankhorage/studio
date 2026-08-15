import type { AppDeployProviderSelection } from '@ankhorage/contracts/deploy';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployTargetsCard({
  config,
}: {
  readonly config: ProjectDeployDashboardState['config'];
}) {
  if (config.status === 'loading')
    return (
      <Card title="Targets">
        <Text>Loading…</Text>
      </Card>
    );
  if (config.status === 'error') {
    return (
      <Card title="Targets">
        <Text color="danger">{config.message}</Text>
      </Card>
    );
  }
  if (config.data === null) {
    return (
      <Card title="Targets">
        <Text color="neutral" emphasis="muted">
          No Deploy target configuration.
        </Text>
      </Card>
    );
  }

  const targets = config.data.targets;
  return (
    <Card title="Targets" description="Canonical target configuration from the app manifest.">
      <KeyValue
        label="Web"
        value={formatTarget(targets.web?.enabled, undefined, targets.web?.providers)}
      />
      <KeyValue
        label="Android"
        value={formatTarget(
          targets.android?.enabled,
          targets.android?.package,
          targets.android?.providers,
        )}
      />
      <KeyValue
        label="iOS"
        value={formatTarget(
          targets.ios?.enabled,
          targets.ios?.bundleIdentifier,
          targets.ios?.providers,
        )}
      />
    </Card>
  );
}

function formatTarget(
  enabled: boolean | undefined,
  identity: string | undefined,
  providers: AppDeployProviderSelection | undefined,
): string {
  if (!enabled) return 'Disabled';
  const detail = [identity, formatProviders(providers)].filter(Boolean).join(' · ');
  return detail ? `Enabled · ${detail}` : 'Enabled';
}

function formatProviders(providers: AppDeployProviderSelection | undefined): string {
  if (!providers) return '';
  const selected = [...new Set([providers.build, providers.publish].filter(isString))];
  return selected.length > 0 ? selected.join(', ') : '';
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
