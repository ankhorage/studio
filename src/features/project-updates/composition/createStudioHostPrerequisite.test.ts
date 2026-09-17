import type { ApmPlanProtocolRequest } from '@ankhorage/apm/types';
import { expect, test } from 'bun:test';

import { createStudioProjectUpdateProtocolPort } from './createStudioProjectUpdateProtocolPort';

test('blocks selected Studio project updates behind the running host restart boundary', async () => {
  const result = await createStudioProjectUpdateProtocolPort().planProtocolAsync(
    protocolRequest('2.7.6', '2.7.7'),
  );

  expect(result.complete).toBe(false);
  expect(result.files).toEqual([]);
  expect(result.steps).toEqual([]);
  expect(result.blockers).toContainEqual({
    code: 'plan.host-upgrade-required',
    scope: { kind: 'host', id: 'studio' },
    evidence: ['installed host 2.7.6', 'latest 2.7.7', 'selected 2.7.7'],
    reason: 'Selected project changes require Studio 2.7.7, but the running host is Studio 2.7.6.',
    nextAction: 'Upgrade Studio to 2.7.7, restart the host, then inspect and create a fresh plan.',
  });
});

test('blocks a Studio host version mismatch even without a host-update finding', async () => {
  const result = await createStudioProjectUpdateProtocolPort().planProtocolAsync(
    protocolRequest('2.7.7', '2.7.8', false),
  );

  expect(result.complete).toBe(false);
  expect(result.blockers).toContainEqual({
    code: 'plan.host-upgrade-required',
    scope: { kind: 'host', id: 'studio' },
    evidence: ['installed host 2.7.7', 'selected 2.7.8'],
    reason: 'Selected project changes require Studio 2.7.8, but the running host is Studio 2.7.7.',
    nextAction: 'Upgrade Studio to 2.7.8, restart the host, then inspect and create a fresh plan.',
  });
});

test('does not block when the selected Studio project version matches the running host', async () => {
  const result = await createStudioProjectUpdateProtocolPort().planProtocolAsync(
    protocolRequest('2.7.7', '2.7.7'),
  );

  expect(result.complete).toBe(true);
  expect(result.blockers).toEqual([]);
});

/*** Build host availability and selected-target evidence matching APM's public planning boundary. */
function protocolRequest(
  runningVersion: string,
  targetVersion: string,
  includeHostUpdate = runningVersion !== targetVersion,
): ApmPlanProtocolRequest {
  return {
    status: {
      schemaVersion: 2,
      operation: 'status',
      rootPath: '/workspace/project',
      complete: true,
      currency: runningVersion === targetVersion ? 'current' : 'outdated',
      project: {
        traits: [],
        languages: [],
        packageManagers: ['bun'],
        buildTools: [],
        packageCount: 1,
        workspaceCount: 0,
      },
      installRoots: [],
      dependencies: [],
      hosts: [
        {
          id: 'studio',
          name: '@ankhorage/studio',
          version: runningVersion,
          availability: {
            packageId: 'host:studio',
            name: '@ankhorage/studio',
            state: 'known',
            latestVersion: targetVersion,
            compatibleVersion: targetVersion,
          },
          findings: includeHostUpdate
            ? [
                {
                  code: 'host-update',
                  scope: { kind: 'host', id: 'studio' },
                  evidence: [`installed host ${runningVersion}`, `latest ${targetVersion}`],
                  reason:
                    'A newer host or extension package is available separately from application updates.',
                },
              ]
            : [],
        },
      ],
      extensions: {
        state: 'unavailable',
        complete: true,
        observations: [],
        diagnostics: [],
      },
      findings: [],
      diagnostics: [],
    },
    policy: {
      dependencyUpdates: 'safe',
      selections: [],
      repairInstallations: false,
      repairProjections: true,
      maxGeneratorIterations: 8,
    },
    inputFingerprint: {
      value: 'fixture',
      statusSchemaVersion: 2,
      availabilityCheckedAt: [],
    },
    targets: [
      {
        installRootId: 'root',
        packageId: '@ankhorage/studio',
        name: '@ankhorage/studio',
        direct: true,
        currentVersion: runningVersion,
        currentRange: `^${runningVersion}`,
        targetVersion,
        targetRange: `^${targetVersion}`,
        source: 'compatible',
        reason: 'A compatible Studio owner update is available.',
      },
    ],
    resolutions: [],
  };
}
