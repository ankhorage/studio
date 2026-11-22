import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

/*** Pack the current checkout and redirect one generated acceptance app to that exact Studio candidate. */
export async function preparePackedStudioCandidateAsync(
  projectRoot: string,
  workspaceRoot: string,
  options: { readonly label: string; readonly timeoutMs: number },
): Promise<void> {
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
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies: Record<string, string>;
  };
  packageJson.dependencies['@ankhorage/studio'] = `file:${tarballPath}`;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}
