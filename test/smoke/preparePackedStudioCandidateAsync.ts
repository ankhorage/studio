import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';
import { reconcileProjectPackageRootAsync } from '../../src/host/orchestrator/reconcileProjectPackageRootAsync';

/*** Pack the current checkout once for a generated acceptance app's exact Studio candidate. */
async function packStudioCandidateAsync(
  workspaceRoot: string,
  options: { readonly label: string; readonly timeoutMs: number },
): Promise<string> {
  const artifactRoot = path.join(workspaceRoot, '.ankh', 'acceptance-artifacts');
  const tarballPath = path.join(artifactRoot, 'studio-candidate.tgz');
  await mkdir(artifactRoot, { recursive: true });
  await runAcceptanceCommandAsync({
    args: ['run', 'build'],
    command: 'bun',
    cwd: process.cwd(),
    label: `Build ${options.label} Studio candidate`,
    timeoutMs: options.timeoutMs,
  });
  await runAcceptanceCommandAsync({
    args: ['pm', 'pack', '--filename', tarballPath, '--ignore-scripts', '--quiet'],
    command: 'bun',
    cwd: process.cwd(),
    label: `Pack ${options.label} Studio candidate`,
    timeoutMs: options.timeoutMs,
  });
  return tarballPath;
}

/*** Redirect a generated acceptance app to the exact packed Studio candidate after owner policy synchronization. */
async function setStudioCandidateAsync(projectRoot: string, tarballPath: string): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies: Record<string, string>;
  };
  packageJson.dependencies['@ankhorage/studio'] = `file:${tarballPath}`;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

/*** Reconcile a generated app through Studio's canonical package pipeline after making the exact packed checkout its Studio dependency. */
export async function reconcilePackedStudioCandidateProjectAsync(
  projectRoot: string,
  workspaceRoot: string,
  options: { readonly label: string; readonly timeoutMs: number },
): Promise<void> {
  const tarballPath = await packStudioCandidateAsync(workspaceRoot, options);
  await reconcileProjectPackageRootAsync(projectRoot, {
    preparePackageRootAsync: (reconciledProjectRoot) =>
      setStudioCandidateAsync(reconciledProjectRoot, tarballPath),
  });
}
