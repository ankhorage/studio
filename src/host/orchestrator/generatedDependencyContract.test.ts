import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { ProjectScaffolder } from './scaffolder';
import { getPackageJson } from './templates';

const temporaryDirectories: string[] = [];
const WEB_TARGETS = { web: { enabled: true } } as const;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('generated app dependency contract', () => {
  it('keeps ZORA runtime peers in standalone package manifests', () => {
    const { dependencies } = getPackageJson({
      name: 'standalone',
      includeStudio: false,
      targets: WEB_TARGETS,
    });

    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, undefined);
  });

  it('keeps runtime peers and authoring dependencies in Studio-enabled manifests', () => {
    const { dependencies } = getPackageJson({
      name: 'studio-enabled',
      includeStudio: true,
      targets: WEB_TARGETS,
    });

    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, 'defined');
  });

  it('retains runtime peers and removes authoring dependencies when Studio is disabled', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: true,
      targets: WEB_TARGETS,
    });
    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: false,
      targets: WEB_TARGETS,
    });

    const dependencies = await readGeneratedDependencies(projectPath);
    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, undefined);
  });

  it('adds authoring dependencies without changing runtime peers when Studio is enabled', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: false,
      targets: WEB_TARGETS,
    });
    const standaloneDependencies = await readGeneratedDependencies(projectPath);

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: true,
      targets: WEB_TARGETS,
    });
    const studioDependencies = await readGeneratedDependencies(projectPath);

    expectRuntimePeers(studioDependencies, standaloneDependencies);
    expectStudioAuthoringDependencies(studioDependencies, 'defined');
  });

  it('preserves app-owned Expo configuration files while synchronizing current output', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();
    await scaffolder.scaffoldProject(projectPath, 'Fixture', 'fixture');
    await Promise.all(
      ['babel.config.js', 'index.js', 'metro.config.js'].map((fileName) =>
        writeFile(path.join(projectPath, fileName), `app-owned ${fileName}`),
      ),
    );

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: WEB_TARGETS,
    });

    const files = await readdir(projectPath);
    expect(files).toContain('babel.config.js');
    expect(files).toContain('index.js');
    expect(files).toContain('metro.config.js');
    await Promise.all(
      ['babel.config.js', 'index.js', 'metro.config.js'].map(async (fileName) => {
        expect(await readFile(path.join(projectPath, fileName), 'utf8')).toBe(
          `app-owned ${fileName}`,
        );
      }),
    );
  });

  it('preserves application-owned development dependencies outside the current template', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();
    await scaffolder.scaffoldProject(projectPath, 'Fixture', 'fixture');
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    packageJson.devDependencies.eslint = '^10.0.0';
    packageJson.devDependencies.prettier = '^4.0.0';
    packageJson.devDependencies['@expo/metro-config'] = '~57.0.0';
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: WEB_TARGETS,
    });

    const synchronized = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(synchronized.devDependencies).toMatchObject({
      eslint: '^10.0.0',
      prettier: '^4.0.0',
      '@expo/metro-config': '~57.0.0',
    });
  });

  it('ignores generated Expo state without replacing app-owned ignore rules', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();
    await scaffolder.scaffoldProject(projectPath, 'Fixture', 'fixture');
    await writeFile(path.join(projectPath, '.gitignore'), 'app-owned-cache/');

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: WEB_TARGETS,
    });
    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      targets: WEB_TARGETS,
    });

    expect(await readFile(path.join(projectPath, '.gitignore'), 'utf8')).toBe(
      'app-owned-cache/\n.expo/\n',
    );
  });
});

async function createScaffoldHarness() {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'ankh-dependency-contract-'));
  temporaryDirectories.push(rootPath);

  return {
    projectPath: path.join(rootPath, 'apps', 'fixture'),
    scaffolder: new ProjectScaffolder(rootPath),
  };
}

async function readGeneratedDependencies(projectPath: string): Promise<Record<string, string>> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectPath, 'package.json'), 'utf8'),
  ) as { dependencies: Record<string, string> };

  return packageJson.dependencies;
}

function expectRuntimePeers(
  {
    '@react-native-picker/picker': nativePicker,
    '@react-native-vector-icons/ionicons': ionicons,
    'expo-font': expoFont,
  }: Record<string, string>,
  expected?: Record<string, string>,
) {
  if (expected === undefined) {
    expect(nativePicker).toBeDefined();
    expect(ionicons).toBeDefined();
    expect(expoFont).toBe('~57.0.1');
    return;
  }

  const {
    '@react-native-picker/picker': expectedNativePicker,
    '@react-native-vector-icons/ionicons': expectedIonicons,
    'expo-font': expectedExpoFont,
  } = expected;
  expect(nativePicker).toBe(expectedNativePicker);
  expect(ionicons).toBe(expectedIonicons);
  expect(expoFont).toBe(expectedExpoFont);
}

function expectStudioAuthoringDependencies(
  {
    '@ankhorage/studio': studio,
    'expo-document-picker': documentPicker,
    'expo-file-system': fileSystem,
    'expo-image-picker': imagePicker,
  }: Record<string, string>,
  expected: 'defined' | undefined,
) {
  if (expected === 'defined') {
    expect(studio).toBeDefined();
    expect(documentPicker).toBeDefined();
    expect(fileSystem).toBeDefined();
    expect(imagePicker).toBeDefined();
    return;
  }

  expect(studio).toBeUndefined();
  expect(documentPicker).toBeUndefined();
  expect(fileSystem).toBeUndefined();
  expect(imagePicker).toBeUndefined();
}
