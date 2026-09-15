import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type {
  ApmDependencyInventory,
  ApmPlanProtocolPort,
  ApmPlanProtocolRequest,
  ApmStatusExtensionEvidencePort,
} from '@ankhorage/apm/types';
import { expect, test } from 'bun:test';

import { digestProjectUpdateText } from '../adapters/outbound/readPendingModuleLifecycleStateAsync';
import {
  STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
  STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
} from '../constants';
import { createStudioProjectUpdateExtensionEvidencePort } from './createStudioProjectUpdateExtensionEvidencePort';
import { createStudioProjectUpdateProtocolPort } from './createStudioProjectUpdateProtocolPort';

test('reports valid pending module removals without mutating their source file', async () => {
  const rootPath = await createProjectRootAsync();
  const pendingPath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);
  const content = `${JSON.stringify(
    {
      ops: [
        { type: 'uninstall', moduleId: 'z-module', at: '2026-09-15T00:00:00.000Z' },
        { type: 'uninstall', moduleId: 'a-module', at: '2026-09-15T00:01:00.000Z' },
      ],
    },
    null,
    2,
  )}\n`;

  try {
    await mkdir(path.dirname(pendingPath), { recursive: true });
    await writeFile(pendingPath, content, 'utf8');
    const evidence =
      await createStudioProjectUpdateExtensionEvidencePort().inspectExtensionEvidenceAsync({
        rootPath,
        inventory: emptyInventory(),
      });

    expect(evidence.complete).toBe(true);
    expect(evidence.observations).toHaveLength(1);
    expect(evidence.observations[0]?.projection).toBe('stale');
    expect(evidence.observations[0]?.evidence).toEqual([
      STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
      STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
      `pending-digest:${digestProjectUpdateText(content)}`,
      'module-uninstall:a-module',
      'module-uninstall:z-module',
    ]);
    expect(await readFile(pendingPath, 'utf8')).toBe(content);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('keeps absent pending state clean and malformed state explicitly incomplete', async () => {
  const rootPath = await createProjectRootAsync();
  const pendingPath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);
  const port = createStudioProjectUpdateExtensionEvidencePort();

  try {
    const absent = await port.inspectExtensionEvidenceAsync({
      rootPath,
      inventory: emptyInventory(),
    });
    expect(absent.complete).toBe(true);
    expect(absent.observations).toEqual([]);

    await mkdir(path.dirname(pendingPath), { recursive: true });
    await writeFile(pendingPath, '{"ops":[{"type":"uninstall"}]}\n', 'utf8');
    const malformed = await port.inspectExtensionEvidenceAsync({
      rootPath,
      inventory: emptyInventory(),
    });

    expect(malformed.complete).toBe(false);
    expect(malformed.observations[0]?.projection).toBe('unknown');
    expect(malformed.diagnostics.map(({ code }) => code)).toContain(
      'studio.pending-module-lifecycle.invalid',
    );
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('preserves existing owner evidence and protocol output while blocking pending lifecycle work', async () => {
  const baseEvidence: ApmStatusExtensionEvidencePort = {
    inspectExtensionEvidenceAsync: () =>
      Promise.resolve({
        state: 'available',
        complete: true,
        observations: [
          {
            owner: '@ankhorage/studio',
            projection: 'current',
            migration: 'not-applicable',
            evidence: ['generated-package-policy:current'],
          },
        ],
        diagnostics: [],
      }),
  };
  const baseProtocol: ApmPlanProtocolPort = {
    planProtocolAsync: () =>
      Promise.resolve({
        complete: true,
        requiredSelections: [],
        files: [],
        artifacts: [],
        steps: [],
        effects: [],
        findings: [],
        blockers: [],
        diagnostics: [
          {
            code: 'base-protocol',
            severity: 'info',
            scope: { kind: 'project' },
            evidence: [],
            reason: 'base protocol preserved',
          },
        ],
      }),
  };
  const rootPath = await createProjectRootAsync();
  const pendingPath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);

  try {
    await mkdir(path.dirname(pendingPath), { recursive: true });
    await writeFile(
      pendingPath,
      '{"ops":[{"type":"uninstall","moduleId":"module-a","at":"2026-09-15T00:00:00.000Z"}]}\n',
      'utf8',
    );
    const extensions = await createStudioProjectUpdateExtensionEvidencePort(
      baseEvidence,
    ).inspectExtensionEvidenceAsync({ rootPath, inventory: emptyInventory() });
    const result = await createStudioProjectUpdateProtocolPort(baseProtocol).planProtocolAsync(
      protocolRequest(rootPath, extensions),
    );

    expect(extensions.observations).toHaveLength(2);
    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toContain('base-protocol');
    expect(result.blockers.map(({ code }) => code)).toContain(
      'protocol.studio-pending-module-lifecycle',
    );
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

/*** Create one isolated project root for owner-evidence tests. */
function createProjectRootAsync(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'studio-pending-module-lifecycle-'));
}

/*** Return the minimal complete dependency inventory required by the extension evidence port. */
function emptyInventory(): ApmDependencyInventory {
  return { roots: [], complete: true, diagnostics: [] };
}

/*** Build one complete synthetic plan-protocol request around supplied extension evidence. */
function protocolRequest(
  rootPath: string,
  extensions: ApmPlanProtocolRequest['status']['extensions'],
): ApmPlanProtocolRequest {
  return {
    status: {
      schemaVersion: 2,
      operation: 'status',
      rootPath,
      complete: true,
      currency: 'outdated',
      project: {
        traits: [],
        languages: [],
        packageManagers: [],
        buildTools: [],
        packageCount: 0,
        workspaceCount: 0,
      },
      installRoots: [],
      dependencies: [],
      hosts: [],
      extensions,
      findings: [],
      diagnostics: [],
    },
    policy: {
      dependencyUpdates: 'none',
      selections: [],
      repairInstallations: false,
      repairProjections: true,
      maxGeneratorIterations: 8,
    },
    inputFingerprint: {
      value: 'fixture-fingerprint',
      statusSchemaVersion: 2,
      availabilityCheckedAt: [],
    },
    targets: [],
    resolutions: [],
  };
}
