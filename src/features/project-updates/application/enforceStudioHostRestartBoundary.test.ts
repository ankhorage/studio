import type { ApmPlanResult } from '@ankhorage/apm/types';
import { describe, expect, it } from 'bun:test';

import { enforceStudioHostRestartBoundary } from './enforceStudioHostRestartBoundary';

describe('enforceStudioHostRestartBoundary', () => {
  it('blocks a plan that selects a Studio owner artifact different from the running host', () => {
    const result = enforceStudioHostRestartBoundary(createPlan('2.7.6'), '2.7.3');

    expect(result.complete).toBe(false);
    expect(result.blockers).toEqual([
      {
        code: 'plan.host-upgrade-required',
        scope: { kind: 'host', id: '@ankhorage/studio' },
        evidence: [
          'running:@ankhorage/studio@2.7.3',
          'target:@ankhorage/studio@2.7.6',
        ],
        reason: 'Running Studio 2.7.3 cannot execute owner work selected for Studio 2.7.6.',
        nextAction: 'Upgrade Studio to 2.7.6, restart the host, then inspect and create a fresh plan.',
      },
    ]);
    expect(result.steps).toEqual([
      {
        id: 'studio-host-restart',
        kind: 'host-restart',
        prerequisites: [],
        owner: '@ankhorage/studio',
        reason:
          'Restart Studio 2.7.3 with the selected 2.7.6 owner artifact before applying project changes.',
        evidence: [
          'running:@ankhorage/studio@2.7.3',
          'required:@ankhorage/studio@2.7.6',
        ],
        execution: {
          kind: 'host-restart',
          hostId: '@ankhorage/studio',
          requiredVersion: '2.7.6',
        },
      },
    ]);
  });

  it('preserves an executable plan when the selected Studio owner matches the running host', () => {
    const plan = createPlan('2.7.6');

    expect(enforceStudioHostRestartBoundary(plan, '2.7.6')).toBe(plan);
  });
});

function createPlan(targetVersion: string): ApmPlanResult {
  return {
    schemaVersion: 2,
    operation: 'plan',
    id: 'plan-one',
    rootPath: '/workspace/project-one',
    complete: true,
    policy: {
      dependencyUpdates: 'safe',
      selections: [],
      repairInstallations: false,
      repairProjections: true,
      maxGeneratorIterations: 4,
    },
    executor: { apmVersion: '0.8.4', runtime: 'node', runtimeVersion: '24.0.0' },
    inputFingerprint: {
      value: 'fingerprint',
      statusSchemaVersion: 2,
      availabilityCheckedAt: [],
    },
    targets: [
      {
        installRootId: 'root',
        packageId: '@ankhorage/studio',
        name: '@ankhorage/studio',
        direct: true,
        currentVersion: '2.7.3',
        currentRange: '^2.7.3',
        targetVersion,
        targetRange: `^${targetVersion}`,
        source: 'compatible',
        reason: 'A compatible Studio release is available.',
      },
    ],
    files: [],
    packages: [],
    artifacts: [],
    steps: [],
    effects: [],
    findings: [],
    blockers: [],
    diagnostics: [],
  };
}
