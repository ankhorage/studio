import { afterEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assertNoStaleExpo57StateAsync } from './assertNoStaleExpo57StateAsync.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('assertNoStaleExpo57StateAsync', () => {
  it('rejects obsolete dependency baselines and local dependency shortcuts', async () => {
    const root = await createRootAsync();
    await writePackageJsonAsync(root, {
      dependencies: {
        '@ankhorage/studio': 'workspace:*',
        expo: '~54.0.37',
        react: '19.1.0',
        'react-native': '0.81.5',
      },
    });

    await expect(assertNoStaleExpo57StateAsync({ root, mode: 'generated-app' })).rejects.toThrow(
      'dependency-expo-sdk54',
    );
  });

  it('accepts a canonical standalone Expo 57 generated package', async () => {
    const root = await createRootAsync();
    await writePackageJsonAsync(root, {
      dependencies: {
        expo: '57.0.17',
        'expo-router': '~57.0.15',
        react: '19.2.3',
        'react-native': '0.86.x',
        'react-native-reanimated': '4.5.1',
        'react-native-worklets': '0.10.1',
      },
      engines: { node: '24.x' },
    });
    await mkdir(path.join(root, 'src', 'app'), { recursive: true });
    await writeFile(
      path.join(root, 'src', 'app', 'index.tsx'),
      'export default function App() {}\n',
    );

    await assertNoStaleExpo57StateAsync({ root, mode: 'generated-app' });
  });

  it('requires an explicit classification for negative evidence strings', async () => {
    const root = await createRootAsync();
    await writeFile(
      path.join(root, 'navigation.test.ts'),
      "expect(source).not.toContain('@react-navigation/');\n",
    );

    await expect(assertNoStaleExpo57StateAsync({ root, mode: 'repository' })).rejects.toThrow(
      'direct-react-navigation-import',
    );
    await assertNoStaleExpo57StateAsync({
      root,
      mode: 'repository',
      allowedFindings: [
        {
          artifactId: 'direct-react-navigation-import',
          relativePath: 'navigation.test.ts',
          reason: 'Negative assertion.',
        },
      ],
    });
  });
});

async function createRootAsync() {
  const root = await mkdtemp(path.join('/tmp', 'ankh-expo57-stale-audit-'));
  roots.push(root);
  return root;
}

async function writePackageJsonAsync(root, value) {
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify(value, null, 2)}\n`);
}
