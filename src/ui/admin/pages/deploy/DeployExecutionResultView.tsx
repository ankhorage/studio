import { Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import type { ProjectDeployReleaseExecutionResponse } from '../../../../projectDeployReleaseExecutionResponse';
import { KeyValue } from '../../adminPagePrimitives';

export function DeployExecutionResultView(props: {
  readonly label: string;
  readonly response: ProjectDeployReleaseExecutionResponse;
}) {
  if (!props.response.result.ok) {
    return (
      <View>
        <Text weight="semiBold">{props.label}</Text>
        <Text color="danger">{props.response.result.failure.code}</Text>
        <Text color="danger">{props.response.result.failure.message}</Text>
      </View>
    );
  }
  const { execution } = props.response.result;
  const { result } = execution;
  return (
    <View>
      <Text weight="semiBold">{props.label}</Text>
      <KeyValue label="Execution id" value={props.response.executionId} />
      <KeyValue label="Status" value={result.status} />
      <KeyValue label="Current revision" value={result.currentRevision} />
      <KeyValue label="Executed steps" value={String(result.executedStepIds.length)} />
      {result.attemptedStepId ? (
        <KeyValue label="Attempted step" value={result.attemptedStepId} />
      ) : null}
      {result.code ? <KeyValue label="Result code" value={result.code} /> : null}
      <KeyValue label="History recorded" value={execution.historyRecorded ? 'yes' : 'no'} />
      {!execution.historyRecorded ? (
        <Text color="danger">Execution history was not recorded successfully.</Text>
      ) : null}
      {execution.historyFailure ? (
        <Text color="danger">
          {execution.historyFailure.code}: {execution.historyFailure.message}
        </Text>
      ) : null}
    </View>
  );
}
