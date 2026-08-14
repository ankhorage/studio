import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function prepareAuth5NativeOAuthSmokeWorkspace(
  workspaceRoot: string,
): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/auth5-native-oauth-smoke',
        private: true,
        packageManager: 'bun@1.3.13',
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
