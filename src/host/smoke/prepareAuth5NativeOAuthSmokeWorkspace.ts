import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*** Create the minimal workspace shell required by the Auth 5 native OAuth smoke fixture.
 * @todo Move this fixture workspace writer from src/host/smoke to test/smoke.
 */
export async function prepareAuth5NativeOAuthSmokeWorkspace(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/auth5-native-oauth-smoke',
        private: true,
        packageManager: 'bun@1.3.14',
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
