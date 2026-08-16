import { Button, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import type { ProjectDeployReleaseInspectionResult } from '../../../../projectDeployReleaseInspectionResult';
import { KeyValue } from '../../adminPagePrimitives';

export function DeployPlanPreview(props: {
  readonly result: ProjectDeployReleaseInspectionResult;
  readonly canExecute: boolean;
  readonly busy: boolean;
  readonly onExecute: () => void;
}) {
  if (!props.result.ok) {
    return (
      <View>
        <Text color="danger" weight="semiBold">
          {props.result.failure.code}
        </Text>
        <Text color="danger">{props.result.failure.message}</Text>
      </View>
    );
  }
  const { inspection, plan } = props.result;
  return (
    <View>
      <KeyValue label="Plan status" value={plan.status} />
      <KeyValue label="Desired revision" value={plan.desiredRevision} />
      <KeyValue label="Current revision" value={plan.currentRevision} />
      <KeyValue label="Required actions" value={String(inspection.actions.length)} />
      {plan.steps.map((step) => (
        <View key={step.id}>
          <Text weight="semiBold">
            {step.target} · {step.operation}
          </Text>
          <Text color={step.irreversible ? 'danger' : 'neutral'} variant="bodySmall">
            {step.irreversible ? 'Irreversible step' : `Retry: ${step.retry}`}
          </Text>
        </View>
      ))}
      {plan.diagnostics.map((diagnostic) => (
        <View key={`${diagnostic.code}:${diagnostic.target ?? 'release'}`}>
          <Text color={diagnostic.severity === 'error' ? 'danger' : 'neutral'} weight="semiBold">
            {diagnostic.code}
          </Text>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {diagnostic.message}
          </Text>
        </View>
      ))}
      {inspection.actions.map((action) => (
        <View key={`${action.type}:${action.code}`}>
          <Text weight="semiBold">{action.code}</Text>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {action.message}
          </Text>
        </View>
      ))}
      {plan.status === 'no-change' ? <Text>No deployment changes are required.</Text> : null}
      <Button disabled={!props.canExecute || props.busy} onPress={props.onExecute}>
        Execute exact plan
      </Button>
    </View>
  );
}
