import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  type AppDeployEnvironmentId,
} from '@ankhorage/contracts/deploy';
import type { AndroidDeploymentTrack } from '@ankhorage/deploy';
import { Button, Card, Select, Text } from '@ankhorage/zora';
import React, { useState } from 'react';
import { View } from 'react-native';

import type { ProjectDeployReleaseInspectionResult } from '../../../../host/deploy/ProjectDeployService';
import type { ProjectDeployRuntimeInput } from '../../../../host/deploy/ProjectDeployRuntimeInput';
import { inspectProjectDeployRelease } from '../../../../projectDeployApi';
import { Field, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

type EnvironmentSelection = AppDeployEnvironmentId | 'unselected';
type TrackSelection = AndroidDeploymentTrack | 'unselected';

const ENVIRONMENT_OPTIONS = [
  { value: 'unselected', label: 'Choose environment' },
  ...APP_DEPLOY_ENVIRONMENT_IDS.map((value) => ({ value, label: value })),
] satisfies readonly { readonly value: EnvironmentSelection; readonly label: string }[];

const ANDROID_TRACK_OPTIONS = [
  { value: 'unselected', label: 'Choose Android track' },
  { value: 'internal', label: 'internal' },
  { value: 'alpha', label: 'alpha' },
  { value: 'beta', label: 'beta' },
  { value: 'production', label: 'production' },
] satisfies readonly { readonly value: TrackSelection; readonly label: string }[];

export function DeployReadinessCard(props: {
  readonly projectId: string;
  readonly release: ProjectDeployDashboardState['release'];
}) {
  const [environment, setEnvironment] = useState<EnvironmentSelection>('unselected');
  const [androidTrack, setAndroidTrack] = useState<TrackSelection>('unselected');
  const [result, setResult] = useState<ProjectDeployReleaseInspectionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsAndroidTrack =
    props.release.status === 'ready' && props.release.data.targets.includes('android');
  const canInspect =
    props.release.status === 'ready' &&
    environment !== 'unselected' &&
    (!needsAndroidTrack || androidTrack !== 'unselected');

  const inspect = async () => {
    if (!canInspect) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const runtime: ProjectDeployRuntimeInput = {
        environment,
        ...(androidTrack === 'unselected' ? {} : { android: { track: androidTrack } }),
      };
      setResult(await inspectProjectDeployRelease({ projectId: props.projectId, runtime }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card
      title="Provider readiness"
      description="Runs Deploy inspection only. No deployment or provider mutation is executed."
    >
      <Field label="Credential environment">
        <Select value={environment} options={ENVIRONMENT_OPTIONS} onValueChange={setEnvironment} />
      </Field>
      {needsAndroidTrack ? (
        <Field label="Android release track">
          <Select
            value={androidTrack}
            options={ANDROID_TRACK_OPTIONS}
            onValueChange={setAndroidTrack}
          />
        </Field>
      ) : null}
      <Button disabled={!canInspect || checking} onPress={() => void inspect()}>
        {checking ? 'Checking…' : 'Check readiness'}
      </Button>
      {props.release.status === 'error' ? (
        <Text color="danger">Prepared release unavailable: {props.release.message}</Text>
      ) : null}
      {props.release.status === 'loading' ? <Text>Loading prepared release…</Text> : null}
      {error ? <Text color="danger">{error}</Text> : null}
      {result ? <ReadinessResult result={result} /> : null}
    </Card>
  );
}

function ReadinessResult({ result }: { readonly result: ProjectDeployReleaseInspectionResult }) {
  if (!result.ok) {
    return (
      <View>
        <Text color="danger" weight="semiBold">
          {result.failure.code}
        </Text>
        <Text color="danger">{result.failure.message}</Text>
      </View>
    );
  }

  return (
    <View>
      <KeyValue label="Plan status" value={result.plan.status} />
      <KeyValue label="Plan steps" value={String(result.plan.steps.length)} />
      <KeyValue label="Diagnostics" value={String(result.plan.diagnostics.length)} />
      <KeyValue label="Required actions" value={String(result.inspection.actions.length)} />
      {result.inspection.actions.map((action) => (
        <View key={`${action.type}:${action.code}`}>
          <Text weight="semiBold">{action.code}</Text>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {action.message}
          </Text>
        </View>
      ))}
    </View>
  );
}
