import type { ApmApplyPermissions, ApmStatusAvailabilityMode } from '@ankhorage/apm/types';
import { useCallback, useEffect, useMemo, useReducer } from 'react';

import type { ProjectUpdatePermissionId } from '../../../../types/project-update-dashboard';
import { createProjectUpdateDashboardState } from '../../application/createProjectUpdateDashboardState';
import { reduceProjectUpdateDashboardState } from '../../application/reduceProjectUpdateDashboardState';
import { createStudioProjectUpdateDashboardService } from '../../composition/createStudioProjectUpdateDashboardService';
import { readProjectUpdateOperationId } from '../../utils/readProjectUpdateOperationId';

/*** Bind one selected project to the authorized Dashboard APM lifecycle and its reviewed state. */
export function useProjectUpdateDashboard(projectId: string) {
  const service = useMemo(() => createStudioProjectUpdateDashboardService(), []);
  const [state, dispatch] = useReducer(
    reduceProjectUpdateDashboardState,
    projectId,
    createProjectUpdateDashboardState,
  );

  useEffect(() => {
    dispatch({ type: 'project-changed', projectId });
  }, [projectId]);

  const inspectAsync = useCallback(async () => {
    dispatch({ type: 'request-started', action: 'status' });
    try {
      const status = await service.inspectAsync(projectId, state.availability);
      dispatch({ type: 'status-received', status });
    } catch (error: unknown) {
      dispatch({ type: 'request-failed', message: readErrorMessage(error) });
    }
  }, [projectId, service, state.availability]);

  const planAsync = useCallback(async () => {
    dispatch({ type: 'request-started', action: 'plan' });
    try {
      const plan = await service.planAsync(projectId, state.availability);
      dispatch({ type: 'plan-received', plan });
    } catch (error: unknown) {
      dispatch({ type: 'request-failed', message: readErrorMessage(error) });
    }
  }, [projectId, service, state.availability]);

  const applyAsync = useCallback(async () => {
    if (state.plan === null) {
      dispatch({ type: 'request-failed', message: 'Inspect and review a plan before applying.' });
      return;
    }
    dispatch({ type: 'request-started', action: 'apply' });
    try {
      const execution = await service.applyAsync(projectId, state.plan, state.permissions);
      dispatch({
        type: 'execution-received',
        execution,
        operationId: readProjectUpdateOperationId(execution),
      });
    } catch (error: unknown) {
      dispatch({ type: 'request-failed', message: readErrorMessage(error) });
    }
  }, [projectId, service, state.permissions, state.plan]);

  const resumeAsync = useCallback(async () => {
    dispatch({ type: 'request-started', action: 'resume' });
    try {
      const execution = await service.resumeAsync(projectId, state.operationId, state.permissions);
      dispatch({
        type: 'execution-received',
        execution,
        operationId: readProjectUpdateOperationId(execution),
      });
    } catch (error: unknown) {
      dispatch({ type: 'request-failed', message: readErrorMessage(error) });
    }
  }, [projectId, service, state.operationId, state.permissions]);

  const verifyAsync = useCallback(async () => {
    dispatch({ type: 'request-started', action: 'verify' });
    try {
      const verification = await service.verifyAsync(projectId, state.operationId);
      dispatch({ type: 'verification-received', verification });
    } catch (error: unknown) {
      dispatch({ type: 'request-failed', message: readErrorMessage(error) });
    }
  }, [projectId, service, state.operationId]);

  const setAvailability = useCallback((availability: ApmStatusAvailabilityMode) => {
    dispatch({ type: 'availability-changed', availability });
  }, []);

  const setPermissionSelection = useCallback((selection: readonly ProjectUpdatePermissionId[]) => {
    dispatch({
      type: 'permissions-changed',
      permissions: selectionToPermissions(selection),
    });
  }, []);

  const setOperationId = useCallback((operationId: string) => {
    dispatch({ type: 'operation-id-changed', operationId });
  }, []);

  return {
    state,
    inspectAsync,
    planAsync,
    applyAsync,
    resumeAsync,
    verifyAsync,
    setAvailability,
    setPermissionSelection,
    setOperationId,
  };
}

function selectionToPermissions(
  selection: readonly ProjectUpdatePermissionId[],
): ApmApplyPermissions {
  return {
    ownerCode: selection.includes('owner-code'),
    lifecycleScripts: selection.includes('lifecycle-scripts'),
    externalEffects: selection.includes('external-effects'),
  };
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Project update request failed.';
}
