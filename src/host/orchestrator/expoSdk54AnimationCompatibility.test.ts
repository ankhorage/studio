import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'bun:test';

import { EXPO_SDK_54_ANIMATION_COMPATIBILITY } from './expoSdk54AnimationCompatibility';
import { getBabelConfigJs, getPackageJson } from './templates';

interface StudioAppPackage {
  readonly dependencies?: Readonly<Record<string, string>>;
}

interface StudioPackage extends StudioAppPackage {
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

describe('Expo SDK 54 first-party animation compatibility', () => {
  it('keeps generated apps and the supported Studio Expo app on one canonical stack', async () => {
    const repositoryRoot = path.resolve(import.meta.dir, '..', '..', '..');
    const studioPackage = JSON.parse(
      await readFile(path.join(repositoryRoot, 'apps', 'studio', 'package.json'), 'utf8'),
    ) as StudioAppPackage;
    const packageMetadata = JSON.parse(
      await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as StudioPackage;
    const studioBabelConfig = await readFile(
      path.join(repositoryRoot, 'apps', 'studio', 'babel.config.js'),
      'utf8',
    );
    const generatedPackage = getPackageJson({
      name: 'generated-sdk-54-app',
      includeStudio: true,
    });
    const generatedDependencies = generatedPackage.dependencies as Record<string, string>;
    const studioDependencies = studioPackage.dependencies ?? {};

    expect(
      generatedDependencies.expo?.startsWith(`~${EXPO_SDK_54_ANIMATION_COMPATIBILITY.expoSdk}.`),
    ).toBe(true);
    expect(
      studioDependencies.expo?.startsWith(`~${EXPO_SDK_54_ANIMATION_COMPATIBILITY.expoSdk}.`),
    ).toBe(true);
    expect(generatedDependencies['react-native-reanimated']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.reanimated,
    );
    expect(generatedDependencies['react-native-worklets']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.worklets,
    );
    expect(studioDependencies['react-native-reanimated']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.reanimated,
    );
    expect(studioDependencies['react-native-worklets']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.worklets,
    );
    expect(generatedDependencies['react-native-gesture-handler']).toBe('~2.28.0');
    expect(studioDependencies['react-native-gesture-handler']).toBe('~2.28.0');
    expect(packageMetadata.dependencies?.['react-native-gesture-handler']).toBeUndefined();
    expect(packageMetadata.peerDependencies?.['react-native-gesture-handler']).toBe('~2.28.0');
    expect(getBabelConfigJs()).toContain(`'${EXPO_SDK_54_ANIMATION_COMPATIBILITY.babelPlugin}'`);
    expect(studioBabelConfig).toContain(`'${EXPO_SDK_54_ANIMATION_COMPATIBILITY.babelPlugin}'`);
    expect(studioBabelConfig).not.toContain("'react-native-reanimated/plugin'");
    expect(Object.values(studioDependencies)).not.toContain('~4.1.1');
    expect(Object.values(studioDependencies)).not.toContain('0.5.1');
  });
});
