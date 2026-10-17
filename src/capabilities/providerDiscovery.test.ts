import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadProviderManifests } from '@ankhorage/ankh';
import { expect, test } from 'bun:test';

import provider from '../cli';
import { CAPABILITIES } from './index';

test('provider discovery accepts the catalog descriptors materialized in package metadata', async () => {
  const packageRoot = await mkdtemp('/tmp/studio-capability-provider-');
  try {
    const packageJson = (await Bun.file(new URL('../../package.json', import.meta.url)).json()) as {
      readonly ankh: {
        readonly capabilities: readonly unknown[];
        readonly category: string;
      };
      readonly name: string;
    };
    const providerPath = join(packageRoot, 'provider.mjs');
    await writeFile(
      providerPath,
      `export default ${JSON.stringify({
        id: provider.id,
        category: provider.category,
        version: provider.version,
        capabilities: provider.capabilities,
        commands: provider.commands,
      })};\n`,
    );

    const result = await loadProviderManifests([
      {
        metadata: {
          category: packageJson.ankh.category,
          provider: './provider.mjs',
          capabilities: packageJson.ankh.capabilities as typeof CAPABILITIES,
        },
        packageJsonPath: join(packageRoot, 'package.json'),
        packageName: packageJson.name,
        packageRoot,
        source: 'current-package',
      },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0]?.manifest.capabilities).toEqual(CAPABILITIES);
  } finally {
    await rm(packageRoot, { force: true, recursive: true });
  }
});
