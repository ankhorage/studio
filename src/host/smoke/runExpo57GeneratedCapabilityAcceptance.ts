import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ProjectManager } from '../orchestrator/projectManager';
import { assertExpo57GeneratedCapabilityContractAsync } from './assertExpo57GeneratedCapabilityContractAsync';
import { assertExpo57GeneratedCapabilityNativePrebuildAsync } from './assertExpo57GeneratedCapabilityNativePrebuildAsync';
import { assertExpo57GeneratedCapabilityOwnerGraphAsync } from './assertExpo57GeneratedCapabilityOwnerGraphAsync';
import { createExpo57CapabilityFixtureManifest } from './createExpo57CapabilityFixtureManifest';
import { generateExpoRouterTypesAsync } from './generateExpoRouterTypesAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 240_000;
const ROUTER_REWRITE_DISABLED = '1';

export async function runExpo57GeneratedCapabilityAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-capabilities-'));

  try {
    await createWorkspaceAsync(workspaceRoot);
    const manager = new ProjectManager(workspaceRoot);
    const created = await manager.createProject(
      'Expo 57 Generated Capability Acceptance',
      { category: 'developer_tools', templateId: 'default' },
      undefined,
      { includeStudio: false },
    );
    await manager.saveProjectManifest({
      projectId: created.id,
      manifest: createExpo57CapabilityFixtureManifest(),
      mutations: [],
    });
    await assertExpo57GeneratedCapabilityContractAsync(created.path);
    await createWorkspaceLockfileAsync(workspaceRoot);
    const lockedDependencies = await readFile(path.join(workspaceRoot, 'bun.lock'));
    await runAcceptanceCommandAsync({
      args: ['install', '--frozen-lockfile', '--linker=hoisted'],
      command: 'bun',
      cwd: workspaceRoot,
      label: 'Cold frozen capability workspace install',
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
    const installedDependencies = await readFile(path.join(workspaceRoot, 'bun.lock'));
    if (!lockedDependencies.equals(installedDependencies)) {
      throw new Error('The frozen generated capability install mutated bun.lock.');
    }
    await assertExpo57GeneratedCapabilityOwnerGraphAsync(
      workspaceRoot,
      created.path,
      COMMAND_TIMEOUT_MS,
    );
    await runGeneratedCapabilityChecksAsync(created.path);
    await assertExpo57GeneratedCapabilityNativePrebuildAsync(created.path);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-generated-capability-acceptance',
        packageManager: 'bun@1.3.14',
        private: true,
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function createWorkspaceLockfileAsync(workspaceRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--linker=hoisted', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: workspaceRoot,
    label: 'Create generated capability workspace lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function runGeneratedCapabilityChecksAsync(projectRoot: string): Promise<void> {
  const setupCommands = [
    { args: ['run', 'format'], command: 'bun', label: 'Generated capability format' },
    {
      args: [
        'x',
        'ankhorage-eslint',
        'src/generated/appExtensionRegistry.ts',
        'src/generated/expo/ExpoBarcodeScannerView.tsx',
        '--fix',
        '--max-warnings=0',
      ],
      command: 'bun',
      label: 'Generated capability adapter lint fix',
    },
    {
      args: [
        'x',
        'ankhorage-eslint',
        'src/generated/appExtensionRegistry.ts',
        'src/generated/expo/ExpoBarcodeScannerView.tsx',
        '--max-warnings=0',
      ],
      command: 'bun',
      label: 'Generated capability adapter lint',
    },
    {
      args: ['x', 'expo', 'install', '--check'],
      command: 'bun',
      label: 'Generated capability Expo dependency compatibility',
    },
    { args: ['run', 'doctor'], command: 'bun', label: 'Generated capability Expo Doctor' },
  ] as const;
  for (const command of setupCommands) await runGeneratedCommandAsync(projectRoot, command);

  await generateExpoRouterTypesAsync({
    env: { EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED },
    label: 'Generated capability Expo Router typed-route generation',
    projectRoot,
    timeoutMs: 120_000,
  });
  await assertRouterTypesAsync(projectRoot);

  const buildCommands = [
    { args: ['run', 'typecheck'], command: 'bun', label: 'Generated capability TypeScript 6' },
    {
      args: ['x', 'expo', 'export', '--platform', 'web', '--clear'],
      command: 'bun',
      label: 'Generated capability Web export',
    },
    {
      args: ['x', 'react-compiler-healthcheck@latest'],
      command: 'bun',
      label: 'Generated capability React Compiler healthcheck',
    },
    {
      args: [
        'x',
        'expo',
        'export',
        '--platform',
        'android',
        '--output-dir',
        'dist-android',
        '--clear',
      ],
      command: 'bun',
      label: 'Generated capability Android JavaScript export',
    },
    {
      args: ['x', 'expo', 'export', '--platform', 'ios', '--output-dir', 'dist-ios', '--clear'],
      command: 'bun',
      label: 'Generated capability iOS JavaScript export',
    },
    {
      args: ['x', 'expo', 'prebuild', '--clean', '--no-install'],
      command: 'bun',
      label: 'Generated capability clean CNG prebuild',
    },
  ] as const;
  for (const command of buildCommands) await runGeneratedCommandAsync(projectRoot, command);
}

async function assertRouterTypesAsync(projectRoot: string): Promise<void> {
  const routerTypes = await readFile(
    path.join(projectRoot, '.expo', 'types', 'router.d.ts'),
    'utf8',
  );
  if (!routerTypes.trim()) throw new Error('Expo Router generated an empty route declaration.');
  for (const route of ['(app)', 'auth/callback', 'sign-in']) {
    if (!routerTypes.includes(route)) {
      throw new Error(`Expo Router declarations are missing capability route ${route}.`);
    }
  }
}

async function runGeneratedCommandAsync(
  projectRoot: string,
  command: { readonly args: readonly string[]; readonly command: string; readonly label: string },
): Promise<void> {
  await runAcceptanceCommandAsync({
    ...command,
    cwd: projectRoot,
    env: {
      EXPO_NO_TELEMETRY: '1',
      EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
    },
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}
