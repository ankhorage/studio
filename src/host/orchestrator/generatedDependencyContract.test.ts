import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { ProjectScaffolder } from './scaffolder';
import { getPackageJson } from './templates';

const temporaryDirectories: string[] = [];

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
    });

    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, undefined);
  });

  it('keeps runtime peers and authoring dependencies in Studio-enabled manifests', () => {
    const { dependencies } = getPackageJson({
      name: 'studio-enabled',
      includeStudio: true,
    });

    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, 'defined');
  });

  it('retains runtime peers and removes authoring dependencies when Studio is disabled', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: true,
    });
    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: false,
    });

    const dependencies = await readGeneratedDependencies(projectPath);
    expectRuntimePeers(dependencies);
    expectStudioAuthoringDependencies(dependencies, undefined);
  });

  it('adds authoring dependencies without changing runtime peers when Studio is enabled', async () => {
    const { projectPath, scaffolder } = await createScaffoldHarness();

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: false,
    });
    const standaloneDependencies = await readGeneratedDependencies(projectPath);

    await scaffolder.syncProjectScaffold(projectPath, 'Fixture', 'fixture', {
      includeStudio: true,
    });
    const studioDependencies = await readGeneratedDependencies(projectPath);

    expectRuntimePeers(studioDependencies, standaloneDependencies);
    expectStudioAuthoringDependencies(studioDependencies, 'defined');
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
    '@expo/vector-icons': vectorIcons,
    '@react-native-picker/picker': nativePicker,
  }: Record<string, string>,
  expected?: Record<string, string>,
) {
  if (expected === undefined) {
    expect(vectorIcons).toBeDefined();
    expect(nativePicker).toBeDefined();
    return;
  }

  const {
    '@expo/vector-icons': expectedVectorIcons,
    '@react-native-picker/picker': expectedNativePicker,
  } = expected;
  expect(vectorIcons).toBe(expectedVectorIcons);
  expect(nativePicker).toBe(expectedNativePicker);
}

function expectStudioAuthoringDependencies(
  {
    'expo-document-picker': documentPicker,
    'expo-file-system': fileSystem,
    'expo-image-picker': imagePicker,
  }: Record<string, string>,
  expected: 'defined' | undefined,
) {
  if (expected === 'defined') {
    expect(documentPicker).toBeDefined();
    expect(fileSystem).toBeDefined();
    expect(imagePicker).toBeDefined();
    return;
  }

  expect(documentPicker).toBeUndefined();
  expect(fileSystem).toBeUndefined();
  expect(imagePicker).toBeUndefined();
}
