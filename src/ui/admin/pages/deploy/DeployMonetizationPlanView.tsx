import { Button, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import type { ProjectDeployMonetizationInspectionResult } from '../../../../projectDeployMonetizationInspectionResult';
import { KeyValue } from '../../adminPagePrimitives';

type SuccessfulInspection = Extract<
  ProjectDeployMonetizationInspectionResult,
  { readonly ok: true }
>;

export function DeployMonetizationPlanView(props: {
  readonly result: SuccessfulInspection;
  readonly canExecute: boolean;
  readonly busy: boolean;
  readonly onExecute: () => void;
}) {
  const { inspection, plan } = props.result;
  return (
    <View>
      <KeyValue label="Plan status" value={plan.status} />
      <KeyValue label="Desired revision" value={plan.desiredRevision} />
      <KeyValue label="Current revision" value={plan.currentRevision} />
      <KeyValue
        label="Android package"
        value={inspection.targets.androidPackage ?? 'not selected'}
      />
      <KeyValue
        label="iOS bundle identifier"
        value={inspection.targets.iosBundleIdentifier ?? 'not selected'}
      />
      {inspection.states.map((state) => (
        <View key={state.target}>
          <Text weight="semiBold">{state.target} observed state</Text>
          <KeyValue label="Products" value={String(state.products.length)} />
          <KeyValue
            label="Subscription families"
            value={String(state.subscriptionFamilies.length)}
          />
          {state.diagnostics.map((diagnostic) => (
            <Text
              key={`${state.target}:${diagnostic.code}:${diagnostic.productId ?? 'target'}`}
              color={diagnostic.severity === 'error' ? 'danger' : 'neutral'}
              variant="bodySmall"
            >
              {diagnostic.code}: {diagnostic.message}
            </Text>
          ))}
        </View>
      ))}
      {plan.steps.map((step) => (
        <Text key={step.id} variant="bodySmall">
          {step.target} · {step.productId} · {step.operation}
        </Text>
      ))}
      {plan.diagnostics.map((diagnostic) => (
        <Text
          key={`${diagnostic.code}:${diagnostic.target ?? 'all'}:${diagnostic.productId ?? 'all'}`}
          color={diagnostic.severity === 'error' ? 'danger' : 'neutral'}
          variant="bodySmall"
        >
          {diagnostic.code}: {diagnostic.message}
        </Text>
      ))}
      {plan.actions.map((action) => (
        <View key={`${action.type}:${action.code}`}>
          <Text weight="semiBold">{action.code}</Text>
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {action.message}
          </Text>
        </View>
      ))}
      {plan.status === 'no-change' ? (
        <Text>No monetization synchronization changes are required.</Text>
      ) : null}
      <Button disabled={!props.canExecute || props.busy} onPress={props.onExecute}>
        Synchronize monetization
      </Button>
    </View>
  );
}
