import { describe, expect, test } from 'bun:test';

import { createProjectUpdateDashboardState } from './createProjectUpdateDashboardState';
import { resolveProjectUpdateDashboardPresentation } from './resolveProjectUpdateDashboardPresentation';

describe('resolveProjectUpdateDashboardPresentation', () => {
  test('keeps dependency evidence and host restart blockers explicit without exposing a root path', () => {
    const presentation = resolveProjectUpdateDashboardPresentation({
      ...createProjectUpdateDashboardState('project-one'),
      status: {
        operation: 'status',
        complete: true,
        currency: 'outdated',
        rootPath: '/workspace/apps/project-one',
        dependencies: [
          {
            packageId: 'root::@ankhorage/studio@2.7.1',
            name: '@ankhorage/studio',
            direct: true,
            lockedVersion: '2.7.1',
            installed: { state: 'present', version: '2.7.1' },
            availability: { state: 'known', compatibleVersion: '2.8.0' },
            findings: [{ code: 'direct-update', reason: 'Compatible update available.' }],
          },
        ],
        extensions: { observations: [] },
        findings: [],
        diagnostics: [],
      },
      plan: {
        operation: 'plan',
        id: 'plan-one',
        complete: false,
        rootPath: '/workspace/apps/project-one',
        targets: [],
        files: [],
        steps: [{ id: 'restart', kind: 'host-restart', reason: 'Restart Studio.', evidence: [] }],
        effects: [{ kind: 'web-redeploy', requirement: 'required', reason: 'Web output changed.' }],
        blockers: [
          {
            code: 'plan.host-upgrade-required',
            reason: 'Running Studio is older than the target owner.',
            nextAction: 'Upgrade and restart Studio.',
          },
        ],
        findings: [],
        diagnostics: [],
      },
    });

    expect(presentation.status?.dependencies).toEqual([
      {
        packageId: 'root::@ankhorage/studio@2.7.1',
        name: '@ankhorage/studio',
        direct: true,
        currentVersion: '2.7.1',
        availableVersion: '2.8.0',
        findings: [
          { code: 'direct-update', reason: 'Compatible update available.', nextAction: undefined },
        ],
      },
    ]);
    expect(presentation.plan?.hostRestartRequired).toBe(true);
    expect(presentation.plan?.canApply).toBe(false);
    expect(presentation.plan?.effects).toEqual([
      { kind: 'web-redeploy', state: 'required', reason: 'Web output changed.' },
    ]);
    expect(JSON.stringify(presentation)).not.toContain('/workspace/apps/project-one');
  });

  test('preserves distinct APM package identities when dependency labels are identical', () => {
    const presentation = resolveProjectUpdateDashboardPresentation({
      ...createProjectUpdateDashboardState('project-one'),
      status: {
        operation: 'status',
        complete: true,
        currency: 'outdated',
        dependencies: [
          {
            packageId: 'root::color-name@1.1.3#first',
            name: 'color-name',
            direct: false,
            lockedVersion: '1.1.3',
            installed: { state: 'present', version: '1.1.3' },
            availability: { state: 'known', compatibleVersion: '2.1.1' },
            findings: [],
          },
          {
            packageId: 'root::color-name@1.1.3#second',
            name: 'color-name',
            direct: false,
            lockedVersion: '1.1.3',
            installed: { state: 'present', version: '1.1.3' },
            availability: { state: 'known', compatibleVersion: '2.1.1' },
            findings: [],
          },
        ],
        extensions: { observations: [] },
        findings: [],
        diagnostics: [],
      },
    });

    expect(presentation.status?.dependencies.map(({ packageId }) => packageId)).toEqual([
      'root::color-name@1.1.3#first',
      'root::color-name@1.1.3#second',
    ]);
  });

  test('keeps verification follow-up separate from successful project update verification', () => {
    const presentation = resolveProjectUpdateDashboardPresentation({
      ...createProjectUpdateDashboardState('project-one'),
      verification: {
        operation: 'verify',
        operationId: 'operation-one',
        verified: true,
        checks: [{ id: 'deps', kind: 'dependency-state', status: 'passed' }],
        findings: [],
        diagnostics: [],
        followUp: [
          {
            kind: 'native-binary',
            requirement: 'required',
            reason: 'Native dependency changed.',
          },
        ],
      },
    });

    expect(presentation.verification?.verified).toBe(true);
    expect(presentation.verification?.followUp).toEqual([
      { kind: 'native-binary', state: 'required', reason: 'Native dependency changed.' },
    ]);
  });
});
