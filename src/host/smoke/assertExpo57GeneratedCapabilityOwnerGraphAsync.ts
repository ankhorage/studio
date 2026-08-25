import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

export async function assertExpo57GeneratedCapabilityOwnerGraphAsync(
  workspaceRoot: string,
  projectRoot: string,
  timeoutMs: number,
): Promise<void> {
  const expectedOwnerVersions = {
    '@ankhorage/expo-runtime': '3.0.5',
    '@ankhorage/permissions': '0.2.3',
    '@ankhorage/supabase-auth': '1.2.6',
  } as const;
  for (const [packageName, expectedVersion] of Object.entries(expectedOwnerVersions)) {
    const installedPackage = JSON.parse(
      await readFile(path.join(workspaceRoot, 'node_modules', packageName, 'package.json'), 'utf8'),
    ) as { readonly version?: string };
    if (installedPackage.version !== expectedVersion) {
      throw new Error(
        `Capability fixture resolved ${packageName} ${String(installedPackage.version)} instead of ${expectedVersion}.`,
      );
    }
  }

  const installedGraph = await runAcceptanceCommandAsync({
    args: ['pm', 'ls', '--all'],
    captureOutput: true,
    command: 'bun',
    cwd: projectRoot,
    label: 'Inspect generated capability dependency graph',
    timeoutMs,
  });
  for (const forbiddenDependency of ['expo-av@', 'expo-permissions@']) {
    if (installedGraph.includes(forbiddenDependency)) {
      throw new Error(`Generated capability graph contains ${forbiddenDependency}.`);
    }
  }
}
