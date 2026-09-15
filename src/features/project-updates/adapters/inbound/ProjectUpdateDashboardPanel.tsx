import type { ApmApplyPermissions, ApmStatusAvailabilityMode } from '@ankhorage/apm/types';
import { CheckboxGroup, Heading, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  InlineMessage,
  LifecycleAction,
  SegmentedControl,
  ThemedWorkspaceTextInput,
} from '../../../../app/workspace/WorkspacePrimitives';
import type {
  ProjectUpdateDashboardState,
  ProjectUpdatePermissionId,
} from '../../../../types/project-update-dashboard';
import { resolveProjectUpdateDashboardPresentation } from '../../application/resolveProjectUpdateDashboardPresentation';
import { useProjectUpdateDashboard } from './useProjectUpdateDashboard';

/*** Render the project-scoped APM inspect, review, apply/recovery, and verify Dashboard lifecycle. */
export function ProjectUpdateDashboardPanel(props: { readonly projectId: string }) {
  const { theme } = useZoraTheme();
  const {
    state,
    inspectAsync,
    planAsync,
    applyAsync,
    resumeAsync,
    verifyAsync,
    setAvailability,
    setPermissionSelection,
    setOperationId,
  } = useProjectUpdateDashboard(props.projectId);
  const presentation = resolveProjectUpdateDashboardPresentation(state);

  return (
    <View
      style={[
        styles.panel,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
      ]}
    >
      <View style={styles.section}>
        <Heading level={3} text="Updates" />
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Inspect APM evidence, review the exact plan, authorize effects, then verify the durable
          operation separately.
        </Text>
        <SegmentedControl
          value={state.availability}
          options={AVAILABILITY_OPTIONS}
          onChange={setAvailability}
        />
        <LifecycleAction
          iconName="search-outline"
          label="Inspect updates"
          detail="Read current dependency, migration, projection, and availability evidence."
          loading={state.busy === 'status'}
          disabled={state.busy !== null}
          onPress={() => void inspectAsync()}
        />
        {state.error ? <InlineMessage tone="error" text={state.error} /> : null}
      </View>

      {presentation.status ? (
        <StatusSection status={presentation.status} state={state} onPlan={() => void planAsync()} />
      ) : null}
      {presentation.plan ? (
        <PlanSection
          plan={presentation.plan}
          state={state}
          onPermissionSelection={setPermissionSelection}
          onApply={() => void applyAsync()}
        />
      ) : null}
      {presentation.execution ? <ExecutionSection execution={presentation.execution} /> : null}
      <RecoverySection
        state={state}
        onOperationIdChange={setOperationId}
        onResume={() => void resumeAsync()}
        onVerify={() => void verifyAsync()}
      />
      {presentation.verification ? (
        <VerificationSection verification={presentation.verification} />
      ) : null}
    </View>
  );
}

const AVAILABILITY_OPTIONS: readonly {
  readonly label: string;
  readonly value: ApmStatusAvailabilityMode;
}[] = [
  { label: 'Refresh registry', value: 'refresh' },
  { label: 'Offline evidence', value: 'offline' },
];

const PERMISSION_OPTIONS: readonly {
  readonly value: ProjectUpdatePermissionId;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'owner-code',
    label: 'Owner code',
    description: 'Allow reviewed package-owned update steps.',
  },
  {
    value: 'lifecycle-scripts',
    label: 'Lifecycle scripts',
    description: 'Allow reviewed package-manager lifecycle scripts when required.',
  },
  {
    value: 'external-effects',
    label: 'External effects',
    description: 'Allow reviewed external-service effects when required.',
  },
];

function StatusSection(props: {
  readonly status: NonNullable<
    ReturnType<typeof resolveProjectUpdateDashboardPresentation>['status']
  >;
  readonly state: ProjectUpdateDashboardState;
  readonly onPlan: () => void;
}) {
  return (
    <View style={styles.section}>
      <Heading level={4} text="Evidence" />
      <Text variant="bodySmall" weight="semiBold">
        {props.status.currency} · {props.status.complete ? 'complete' : 'incomplete'}
      </Text>
      <DetailItems
        title="Dependencies"
        empty="No dependency changes are currently reported."
        items={props.status.dependencies.map(
          (dependency) =>
            `${dependency.name} · ${dependency.direct ? 'direct' : 'transitive'} · ${dependency.currentVersion} → ${dependency.availableVersion}`,
        )}
      />
      <DetailItems
        title="Migration & projection evidence"
        empty="No extension observations are currently reported."
        items={props.status.observations.map(
          (observation) =>
            `${observation.owner} · projection ${observation.projection} · migration ${observation.migration}${observation.reason ? ` · ${observation.reason}` : ''}`,
        )}
      />
      <ReasonItems title="Findings" items={props.status.findings} />
      <ReasonItems title="Diagnostics" items={props.status.diagnostics} />
      <LifecycleAction
        iconName="git-compare-outline"
        label="Review update plan"
        detail="Create a concrete safe-update and repair plan from fresh host evidence."
        loading={props.state.busy === 'plan'}
        disabled={props.state.busy !== null}
        onPress={props.onPlan}
      />
    </View>
  );
}

function PlanSection(props: {
  readonly plan: NonNullable<ReturnType<typeof resolveProjectUpdateDashboardPresentation>['plan']>;
  readonly state: ProjectUpdateDashboardState;
  readonly onPermissionSelection: (selection: readonly ProjectUpdatePermissionId[]) => void;
  readonly onApply: () => void;
}) {
  return (
    <View style={styles.section}>
      <Heading level={4} text="Reviewed plan" />
      <Text variant="bodySmall" weight="semiBold">
        {props.plan.id} · {props.plan.complete ? 'complete' : 'blocked'}
      </Text>
      <DetailItems
        title="Dependency targets"
        empty="No dependency version changes."
        items={props.plan.targets.map(
          (target) =>
            `${target.name} · ${target.direct ? 'direct' : 'transitive'} · ${target.currentVersion} → ${target.targetVersion} · ${target.reason}`,
        )}
      />
      <DetailItems
        title="File changes"
        empty="No reviewed file changes."
        items={props.plan.files.map((file) => `${file.kind} · ${file.path}`)}
      />
      <DetailItems
        title="Ordered steps"
        empty="No executable steps."
        items={props.plan.steps.map((step) => `${step.kind} · ${step.reason}`)}
      />
      <EffectItems title="Shipment & follow-up effects" effects={props.plan.effects} />
      <ReasonItems title="Plan blockers" items={props.plan.blockers} />
      <ReasonItems title="Plan findings" items={props.plan.findings} />
      {props.plan.hostRestartRequired ? (
        <InlineMessage
          tone="info"
          text="Studio host upgrade/restart is required. Restart the host, then Inspect updates again and create a fresh plan; this reviewed plan is not executable across the restart boundary."
        />
      ) : null}
      {props.plan.canApply ? (
        <>
          <View style={styles.permissions}>
            <Text weight="semiBold">Execution permissions</Text>
            <Text color="neutral" emphasis="muted" variant="caption">
              Every permission is explicit. Leave an effect disabled unless the reviewed plan
              requires and you approve it.
            </Text>
            <CheckboxGroup
              value={permissionSelection(props.state.permissions)}
              options={PERMISSION_OPTIONS}
              orientation="vertical"
              gap="s"
              onValueChange={props.onPermissionSelection}
            />
          </View>
          <LifecycleAction
            iconName="play-outline"
            label="Apply reviewed plan"
            detail="Execute only this reviewed plan through APM's durable lock and journal."
            loading={props.state.busy === 'apply'}
            disabled={props.state.busy !== null}
            onPress={props.onApply}
          />
        </>
      ) : null}
    </View>
  );
}

function ExecutionSection(props: {
  readonly execution: NonNullable<
    ReturnType<typeof resolveProjectUpdateDashboardPresentation>['execution']
  >;
}) {
  const tone = props.execution.status === 'completed' ? 'success' : 'info';
  return (
    <View style={styles.section}>
      <Heading level={4} text="Execution" />
      <InlineMessage
        tone={tone}
        text={`Operation ${props.execution.operationId || 'unknown'}: ${props.execution.status}.`}
      />
      <DetailItems
        title="Journal steps"
        empty="No journal steps are available yet."
        items={props.execution.steps.map(
          (step) =>
            `${step.id} · ${step.state} · ${step.attempts} attempt${step.attempts === 1 ? '' : 's'}`,
        )}
      />
      <ReasonItems title="Execution blockers" items={props.execution.blockers} />
      <ReasonItems title="Execution diagnostics" items={props.execution.diagnostics} />
      {props.execution.status === 'recovery-required' ? (
        <InlineMessage
          tone="info"
          text="Recovery is durable. Keep the operation ID below and resume the same APM journal; do not start a replacement update."
        />
      ) : null}
    </View>
  );
}

function RecoverySection(props: {
  readonly state: ProjectUpdateDashboardState;
  readonly onOperationIdChange: (operationId: string) => void;
  readonly onResume: () => void;
  readonly onVerify: () => void;
}) {
  const hasOperation = props.state.operationId.trim().length > 0;
  return (
    <View style={styles.section}>
      <Heading level={4} text="Recovery & verification" />
      <Text color="neutral" emphasis="muted" variant="caption">
        Durable operation IDs can be resumed after interruption or entered again after reloading the
        Dashboard. Verification is a separate evidence pass.
      </Text>
      <ThemedWorkspaceTextInput
        value={props.state.operationId}
        onChangeText={props.onOperationIdChange}
        placeholder="APM operation ID"
        accessibilityLabel="APM operation ID"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.actions}>
        <LifecycleAction
          iconName="refresh-circle-outline"
          label="Resume operation"
          detail="Resume the same durable APM journal and its recovery semantics."
          loading={props.state.busy === 'resume'}
          disabled={props.state.busy !== null || !hasOperation}
          onPress={props.onResume}
        />
        <LifecycleAction
          iconName="checkmark-circle-outline"
          label="Verify operation"
          detail="Reinspect project and owner evidence for this operation after execution."
          loading={props.state.busy === 'verify'}
          disabled={props.state.busy !== null || !hasOperation}
          onPress={props.onVerify}
        />
      </View>
    </View>
  );
}

function VerificationSection(props: {
  readonly verification: NonNullable<
    ReturnType<typeof resolveProjectUpdateDashboardPresentation>['verification']
  >;
}) {
  return (
    <View style={styles.section}>
      <Heading level={4} text="Verification" />
      <InlineMessage
        tone={props.verification.verified ? 'success' : 'info'}
        text={`Operation ${props.verification.operationId || 'unknown'} is ${props.verification.verified ? 'verified' : 'not fully verified'}.`}
      />
      <DetailItems
        title="Checks"
        empty="No verification checks were returned."
        items={props.verification.checks.map(
          (check) =>
            `${check.kind} · ${check.status}${check.reason ? ` · ${check.reason}` : ''}${check.nextAction ? ` · next: ${check.nextAction}` : ''}`,
        )}
      />
      <ReasonItems title="Remaining findings" items={props.verification.findings} />
      <ReasonItems title="Verification diagnostics" items={props.verification.diagnostics} />
      <EffectItems title="Shipment & follow-up" effects={props.verification.followUp} />
    </View>
  );
}

function DetailItems(props: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty: string;
}) {
  return (
    <View style={styles.detailList}>
      <Text weight="semiBold" variant="bodySmall">
        {props.title}
      </Text>
      {props.items.length === 0 ? (
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.empty}
        </Text>
      ) : (
        props.items.map((item) => (
          <Text key={item} variant="caption">
            • {item}
          </Text>
        ))
      )}
    </View>
  );
}

function ReasonItems(props: {
  readonly title: string;
  readonly items: readonly {
    readonly code?: string;
    readonly reason: string;
    readonly nextAction?: string;
  }[];
}) {
  return (
    <DetailItems
      title={props.title}
      empty={`No ${props.title.toLowerCase()}.`}
      items={props.items.map(
        (item) =>
          `${item.code ? `${item.code} · ` : ''}${item.reason}${item.nextAction ? ` · next: ${item.nextAction}` : ''}`,
      )}
    />
  );
}

function EffectItems(props: {
  readonly title: string;
  readonly effects: readonly {
    readonly kind: string;
    readonly state: string;
    readonly reason: string;
  }[];
}) {
  return (
    <DetailItems
      title={props.title}
      empty="No shipment or follow-up effects."
      items={props.effects.map((effect) => `${effect.kind} · ${effect.state} · ${effect.reason}`)}
    />
  );
}

function permissionSelection(permissions: ApmApplyPermissions): ProjectUpdatePermissionId[] {
  return [
    ...(permissions.ownerCode ? (['owner-code'] as const) : []),
    ...(permissions.lifecycleScripts ? (['lifecycle-scripts'] as const) : []),
    ...(permissions.externalEffects ? (['external-effects'] as const) : []),
  ];
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    flexBasis: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  detailList: {
    gap: 4,
  },
  permissions: {
    gap: 8,
  },
  actions: {
    gap: 10,
  },
});
