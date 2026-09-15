import { describe, expect, test } from 'bun:test';

import { createProjectUpdateDashboardState } from './createProjectUpdateDashboardState';
import { reduceProjectUpdateDashboardState } from './reduceProjectUpdateDashboardState';

describe('reduceProjectUpdateDashboardState', () => {
  test('invalidates a reviewed plan as soon as fresh status evidence is requested', () => {
    const initial = createProjectUpdateDashboardState('project-one');
    const planned = reduceProjectUpdateDashboardState(initial, {
      type: 'plan-received',
      plan: { operation: 'plan', id: 'plan-one' },
    });
    const refreshing = reduceProjectUpdateDashboardState(planned, {
      type: 'request-started',
      action: 'status',
    });

    expect(planned.plan).not.toBeNull();
    expect(refreshing.plan).toBeNull();
    expect(refreshing.busy).toBe('status');
  });

  test('resets project-scoped reviewed and recovery state when the selected project changes', () => {
    const initial = {
      ...createProjectUpdateDashboardState('project-one'),
      status: { operation: 'status' },
      plan: { operation: 'plan' },
      execution: { operation: 'apply' },
      verification: { operation: 'verify' },
      operationId: 'operation-one',
      permissions: {
        ownerCode: true,
        lifecycleScripts: true,
        externalEffects: true,
      },
    };
    const changed = reduceProjectUpdateDashboardState(initial, {
      type: 'project-changed',
      projectId: 'project-two',
    });

    expect(changed).toEqual(createProjectUpdateDashboardState('project-two'));
  });

  test('keeps a durable operation id while invalidating the executed plan', () => {
    const planned = {
      ...createProjectUpdateDashboardState('project-one'),
      plan: { operation: 'plan', id: 'plan-one' },
    };
    const executed = reduceProjectUpdateDashboardState(planned, {
      type: 'execution-received',
      execution: { operation: 'apply', status: 'recovery-required' },
      operationId: 'operation-one',
    });

    expect(executed.plan).toBeNull();
    expect(executed.operationId).toBe('operation-one');
    expect(executed.execution).toEqual({ operation: 'apply', status: 'recovery-required' });
  });
});
