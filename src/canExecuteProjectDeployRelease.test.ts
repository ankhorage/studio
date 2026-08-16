import type { ReleasePlanStatus } from '@ankhorage/deploy';
import { expect, test } from 'bun:test';

import { canExecuteProjectDeployRelease } from './canExecuteProjectDeployRelease';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';

test('only an actionable owner plan without required actions can execute', () => {
  expect(canExecuteProjectDeployRelease(resultFor('changes'))).toBe(true);
  expect(canExecuteProjectDeployRelease(resultFor('no-change'))).toBe(false);
  expect(canExecuteProjectDeployRelease(resultFor('waiting'))).toBe(false);
  expect(canExecuteProjectDeployRelease(resultFor('blocked'))).toBe(false);
  expect(canExecuteProjectDeployRelease(resultFor('changes', true))).toBe(false);
});

function resultFor(
  status: ReleasePlanStatus,
  withAction = false,
): ProjectDeployReleaseInspectionResult {
  return {
    ok: true,
    inspection: {
      projectRoot: '/tmp/demo',
      desired: {
        version: '1.0.0',
        targets: ['web'],
        notes: [],
        rollout: {},
        revision: 'desired-r1',
      },
      observed: { targets: [] },
      currentRevision: 'current-r1',
      actions: withAction
        ? [
            {
              type: 'authentication',
              provider: 'test',
              code: 'AUTH_REQUIRED',
              message: 'Authentication required.',
            },
          ]
        : [],
    },
    plan: {
      status,
      desiredRevision: 'desired-r1',
      currentRevision: 'current-r1',
      steps: [],
      diagnostics: [],
    },
  };
}
