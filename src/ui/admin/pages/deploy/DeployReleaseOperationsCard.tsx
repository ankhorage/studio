import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  type AppDeployEnvironmentId,
} from '@ankhorage/contracts/deploy';
import type {
  AndroidDeploymentTrack,
  ReleaseControlExecutionResult,
  ReleaseLifecycleControl,
} from '@ankhorage/deploy';
import { Button, Card, ConfirmDialog, Select, Text } from '@ankhorage/zora';
import React, { useRef, useState } from 'react';

import { canExecuteProjectDeployRelease } from '../../../../canExecuteProjectDeployRelease';
import {
  executeProjectDeployRelease,
  executeProjectDeployReleaseControl,
  inspectProjectDeployRelease,
  resumeProjectDeployRelease,
} from '../../../../projectDeployApi';
import type { ProjectDeployReleaseExecutionResponse } from '../../../../projectDeployReleaseExecutionResponse';
import type { ProjectDeployReleaseInspectionResult } from '../../../../projectDeployReleaseInspectionResult';
import type { ProjectDeployRuntimeInput } from '../../../../projectDeployRuntimeInput';
import { Field } from '../../adminPagePrimitives';
import { DeployControlResultView } from './DeployControlResultView';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployExecutionResultView } from './DeployExecutionResultView';
import { DeployLifecycleControls } from './DeployLifecycleControls';
import { DeployPlanPreview } from './DeployPlanPreview';
import { DeployResumeActions } from './DeployResumeActions';

type EnvironmentSelection = AppDeployEnvironmentId | 'unselected';
type TrackSelection = AndroidDeploymentTrack | 'unselected';

interface ReleasePreview {
  readonly runtime: ProjectDeployRuntimeInput;
  readonly result: ProjectDeployReleaseInspectionResult;
}
interface PendingResume {
  readonly previousExecutionId: string;
  readonly runtime: ProjectDeployRuntimeInput;
}
interface PendingControl {
  readonly control: ReleaseLifecycleControl;
  readonly runtime: ProjectDeployRuntimeInput;
}
interface ExecutionOutcome {
  readonly label: string;
  readonly response: ProjectDeployReleaseExecutionResponse;
}

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

export function DeployReleaseOperationsCard(props: {
  readonly projectId: string;
  readonly release: ProjectDeployDashboardState['release'];
  readonly history: ProjectDeployDashboardState['history'];
  readonly onMutation: () => void;
}) {
  const [environment, setEnvironment] = useState<EnvironmentSelection>('unselected');
  const [androidTrack, setAndroidTrack] = useState<TrackSelection>('unselected');
  const [preview, setPreview] = useState<ReleasePreview | null>(null);
  const [outcome, setOutcome] = useState<ExecutionOutcome | null>(null);
  const [controlResult, setControlResult] = useState<ReleaseControlExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExecute, setConfirmExecute] = useState(false);
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null);
  const [pendingControl, setPendingControl] = useState<PendingControl | null>(null);
  const mutationInFlightRef = useRef(false);

  const needsAndroidTrack =
    props.release.status === 'ready' && props.release.data.targets.includes('android');
  const runtime = createRuntime(environment, androidTrack, needsAndroidTrack);
  const canInspect = props.release.status === 'ready' && runtime !== null;
  const successfulResult = preview !== null && preview.result.ok ? preview.result : null;
  const canExecute =
    successfulResult !== null &&
    canExecuteProjectDeployRelease(successfulResult) &&
    outcome === null &&
    controlResult === null &&
    !busy;
  const controls =
    successfulResult !== null && outcome === null && controlResult === null
      ? successfulResult.lifecycleControls
      : [];
  const irreversibleCount =
    successfulResult?.plan.steps.filter((step) => step.irreversible).length ?? 0;

  const resetPreviewState = () => {
    setPreview(null);
    setOutcome(null);
    setControlResult(null);
    setError(null);
    setConfirmExecute(false);
    setPendingResume(null);
    setPendingControl(null);
  };

  const previewRelease = async () => {
    if (!runtime || props.release.status !== 'ready') return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    setControlResult(null);
    try {
      const result = await inspectProjectDeployRelease({ projectId: props.projectId, runtime });
      setPreview({ runtime, result });
    } catch (caught) {
      setPreview(null);
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  const executeRelease = async () => {
    const current = preview;
    if (!current?.result.ok || !canExecuteProjectDeployRelease(current.result)) return;
    if (!beginMutation(mutationInFlightRef, setBusy)) return;
    setConfirmExecute(false);
    setError(null);
    try {
      const response = await executeProjectDeployRelease({
        projectId: props.projectId,
        runtime: current.runtime,
        inspection: current.result.inspection,
        plan: current.result.plan,
      });
      setOutcome({ label: 'Release execution', response });
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      endMutation(mutationInFlightRef, setBusy);
    }
  };

  const resumeRelease = async () => {
    const current = pendingResume;
    if (!current || !beginMutation(mutationInFlightRef, setBusy)) return;
    setPendingResume(null);
    setError(null);
    try {
      const response = await resumeProjectDeployRelease({
        projectId: props.projectId,
        runtime: current.runtime,
        previousExecutionId: current.previousExecutionId,
      });
      setPreview(null);
      setOutcome({ label: 'Resumed execution', response });
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      endMutation(mutationInFlightRef, setBusy);
    }
  };

  const executeControl = async () => {
    const current = pendingControl;
    if (!current || !beginMutation(mutationInFlightRef, setBusy)) return;
    setPendingControl(null);
    setError(null);
    try {
      const result = await executeProjectDeployReleaseControl({
        projectId: props.projectId,
        runtime: current.runtime,
        control: current.control,
      });
      setPreview(null);
      setControlResult(result);
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      endMutation(mutationInFlightRef, setBusy);
    }
  };

  const chooseResume = (previousExecutionId: string) => {
    if (!runtime) return;
    setPendingResume({ previousExecutionId, runtime });
  };
  const chooseControl = (control: ReleaseLifecycleControl) => {
    if (!runtime) return;
    setPendingControl({ control, runtime });
  };

  return (
    <Card
      title="Release plan and execution"
      description="Preview the canonical Deploy plan, confirm it explicitly, then execute that exact inspected snapshot."
    >
      <Field label="Credential environment">
        <Select
          value={environment}
          options={ENVIRONMENT_OPTIONS}
          onValueChange={(value) => {
            resetPreviewState();
            setEnvironment(value);
          }}
        />
      </Field>
      {needsAndroidTrack ? (
        <Field label="Android release track">
          <Select
            value={androidTrack}
            options={ANDROID_TRACK_OPTIONS}
            onValueChange={(value) => {
              resetPreviewState();
              setAndroidTrack(value);
            }}
          />
        </Field>
      ) : null}
      <Button disabled={!canInspect || busy} onPress={() => void previewRelease()}>
        {busy ? 'Working…' : 'Preview release plan'}
      </Button>
      {props.release.status === 'error' ? (
        <Text color="danger">Prepared release unavailable: {props.release.message}</Text>
      ) : null}
      {props.release.status === 'loading' ? <Text>Loading prepared release…</Text> : null}
      {error ? <Text color="danger">{error}</Text> : null}
      {preview ? (
        <DeployPlanPreview
          result={preview.result}
          canExecute={canExecute}
          busy={busy}
          onExecute={() => setConfirmExecute(true)}
        />
      ) : null}
      <DeployLifecycleControls
        controls={controls}
        disabled={busy || runtime === null}
        onControl={chooseControl}
      />
      <DeployResumeActions
        history={props.history}
        disabled={busy || runtime === null}
        onResume={chooseResume}
      />
      {outcome ? (
        <DeployExecutionResultView label={outcome.label} response={outcome.response} />
      ) : null}
      {controlResult ? <DeployControlResultView result={controlResult} /> : null}
      <ConfirmDialog
        visible={confirmExecute}
        title="Execute deployment plan?"
        description={`Execute this exact Deploy plan with ${
          successfulResult?.plan.steps.length ?? 0
        } steps, including ${irreversibleCount} irreversible step(s)? Deploy remains authoritative for drift safety.`}
        confirmLabel="Execute deployment"
        confirmColor="danger"
        cancelLabel="Cancel"
        onCancel={() => setConfirmExecute(false)}
        onConfirm={() => void executeRelease()}
      />
      <ConfirmDialog
        visible={pendingResume !== null}
        title="Resume release execution?"
        description={`Resume ${pendingResume?.previousExecutionId ?? ''} through the Deploy owner API?`}
        confirmLabel="Resume execution"
        cancelLabel="Cancel"
        onCancel={() => setPendingResume(null)}
        onConfirm={() => void resumeRelease()}
      />
      <ConfirmDialog
        visible={pendingControl !== null}
        title="Execute lifecycle control?"
        description={`Execute ${pendingControl?.control.target ?? ''}:${
          pendingControl?.control.action ?? ''
        } through the Deploy owner API?`}
        confirmLabel="Execute control"
        cancelLabel="Cancel"
        onCancel={() => setPendingControl(null)}
        onConfirm={() => void executeControl()}
      />
    </Card>
  );
}

function createRuntime(
  environment: EnvironmentSelection,
  androidTrack: TrackSelection,
  needsAndroidTrack: boolean,
): ProjectDeployRuntimeInput | null {
  if (environment === 'unselected') return null;
  if (needsAndroidTrack && androidTrack === 'unselected') return null;
  return {
    environment,
    ...(androidTrack === 'unselected' ? {} : { android: { track: androidTrack } }),
  };
}

function beginMutation(
  ref: React.MutableRefObject<boolean>,
  setBusy: React.Dispatch<React.SetStateAction<boolean>>,
): boolean {
  if (ref.current) return false;
  ref.current = true;
  setBusy(true);
  return true;
}

function endMutation(
  ref: React.MutableRefObject<boolean>,
  setBusy: React.Dispatch<React.SetStateAction<boolean>>,
): void {
  ref.current = false;
  setBusy(false);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
