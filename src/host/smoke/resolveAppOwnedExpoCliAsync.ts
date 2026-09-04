import { access } from 'node:fs/promises';
import path from 'node:path';

/***
 * Resolve and require the Expo CLI binary installed by a generated fixture rather than an ambient executable.
 * @todo Move this Expo acceptance helper out of src/host into test/smoke.
 */
export async function resolveAppOwnedExpoCliAsync(projectRoot: string): Promise<string> {
  const expoCli = path.join(projectRoot, 'node_modules', '.bin', 'expo');

  try {
    await access(expoCli);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `App-owned Expo CLI is missing: ${expoCli}\n` +
          `Run 'bun install --frozen-lockfile' in ${projectRoot} before running Expo acceptance.`,
        { cause: error },
      );
    }
    throw error;
  }

  return expoCli;
}
