import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  type AppDeployEnvironmentId,
} from '@ankhorage/contracts/deploy';
import type { ProjectMonetizationExecutionResult } from '@ankhorage/deploy/project';
import { Button, Card, ConfirmDialog, Select, Text } from '@ankhorage/zora';
import React, { useRef, useState } from 'react';

import {
  executeProjectDeployMonetization,
  inspectProjectDeployMonetization,
} from '../../../../projectDeployApi';
import type { ProjectDeployMonetizationInspectionResult } from '../../../../projectDeployMonetizationInspectionResult';
import type { ProjectDeployRuntimeInput } from '../../../../projectDeployRuntimeInput';
import { Field } from '../../adminPagePrimitives';
import { DeployMonetizationExecutionView } from './DeployMonetizationExecutionView';
import { DeployMonetizationPlanView } from './DeployMonetizationPlanView';

type EnvironmentSelection = AppDeployEnvironmentId | 'unselected';

interface MonetizationPreview {
  readonly runtime: ProjectDeployRuntimeInput;
  readonly result: ProjectDeployMonetizationInspectionResult;
}

const ENVIRONMENT_OPTIONS = [
  { value: 'unselected', label: 'Choose environment' },
  ...APP_DEPLOY_ENVIRONMENT_IDS.map((value) => ({ value, label: value })),
] satisfies readonly { readonly value: EnvironmentSelection; readonly label: string }[];

export function DeployMonetizationSyncCard(props: {
  readonly projectId: string;
  readonly onComplete: () => void;
}) {
  const [environment, setEnvironment] = useState<EnvironmentSelection>('unselected');
  const [preview, setPreview] = useState<MonetizationPreview | null>(null);
  const [result, setResult] = useState<ProjectMonetizationExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const mutationInFlightRef = useRef(false);

  const successful = preview !== null && preview.result.ok ? preview.result : null;
  const canExecute = successful?.plan.status === 'changes' && result === null && !busy;

  const inspect = async () => {
    if (environment === 'unselected') return;
    const runtime: ProjectDeployRuntimeInput = { environment };
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const inspected = await inspectProjectDeployMonetization({
        projectId: props.projectId,
        runtime,
      });
      setPreview({ runtime, result: inspected });
    } catch (caught) {
      setPreview(null);
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    const current = preview;
    if (!current?.result.ok || current.result.plan.status !== 'changes') return;
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setConfirm(false);
    setBusy(true);
    setError(null);
    try {
      const executed = await executeProjectDeployMonetization({
        projectId: props.projectId,
        runtime: current.runtime,
        inspection: current.result.inspection,
        plan: current.result.plan,
      });
      setResult(executed);
      props.onComplete();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      mutationInFlightRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Card
      title="Monetization synchronization"
      description="Inspect provider state, preview Deploy's canonical plan, then explicitly confirm synchronization of that exact snapshot."
    >
      <Field label="Credential environment">
        <Select
          value={environment}
          options={ENVIRONMENT_OPTIONS}
          onValueChange={(value) => {
            setEnvironment(value);
            setPreview(null);
            setResult(null);
            setError(null);
            setConfirm(false);
          }}
        />
      </Field>
      <Button
        disabled={environment === 'unselected' || busy}
        variant="outline"
        onPress={() => void inspect()}
      >
        {busy ? 'Working…' : 'Preview monetization synchronization'}
      </Button>
      {error ? <Text color="danger">{error}</Text> : null}
      {preview && !preview.result.ok ? <ViewFailure result={preview.result} /> : null}
      {successful ? (
        <DeployMonetizationPlanView
          result={successful}
          canExecute={canExecute}
          busy={busy}
          onExecute={() => setConfirm(true)}
        />
      ) : null}
      {result ? <DeployMonetizationExecutionView result={result} /> : null}
      <ConfirmDialog
        visible={confirm}
        title="Synchronize monetization?"
        description={`Execute this exact Deploy monetization plan with ${
          successful?.plan.steps.length ?? 0
        } step(s)? Deploy will re-inspect for drift before provider mutation and verify afterward.`}
        confirmLabel="Synchronize monetization"
        confirmColor="danger"
        cancelLabel="Cancel"
        onCancel={() => setConfirm(false)}
        onConfirm={() => void execute()}
      />
    </Card>
  );
}

function ViewFailure({
  result,
}: {
  readonly result: Extract<ProjectDeployMonetizationInspectionResult, { readonly ok: false }>;
}) {
  return (
    <>
      <Text color="danger" weight="semiBold">
        {result.failure.code}
      </Text>
      <Text color="danger">{result.failure.message}</Text>
    </>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
