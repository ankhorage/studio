import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';

import { ProjectManager } from '../orchestrator/projectManager';

export async function runExpo57GeneratedAppAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-acceptance-'));

  try {
    const projectRoot = await createGeneratedProjectAsync(workspaceRoot);
    await createWorkspaceLockfileAsync(workspaceRoot);
    await runAcceptanceChecksAsync(projectRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function createGeneratedProjectAsync(workspaceRoot: string): Promise<string> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-generated-app-acceptance',
        packageManager: 'bun@1.3.14',
        private: true,
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const projectManager = new ProjectManager(workspaceRoot);
  const created = await projectManager.createProject(
    'Expo 57 Generated App Acceptance',
    { category: 'developer_tools', templateId: 'default' },
    undefined,
    { includeStudio: false },
  );
  const manifest = await projectManager.getProjectManifest(created.id);
  const screen = resolveAcceptanceScreen(manifest);
  const { auth: _auth, ...infra } = manifest.infra;
  const acceptanceScreen: ScreenSpec = {
    ...screen,
    root: {
      id: 'expo57-acceptance-screen',
      type: 'Screen',
      props: {},
    },
  };

  await projectManager.saveProjectManifest({
    projectId: created.id,
    manifest: {
      ...manifest,
      infra,
      navigator: {
        type: 'stack',
        initialRouteName: 'index',
        routes: [{ name: 'index', screenId: acceptanceScreen.id }],
      },
      screens: { [acceptanceScreen.id]: acceptanceScreen },
    },
    mutations: [],
  });

  return created.path;
}

async function createWorkspaceLockfileAsync(workspaceRoot: string): Promise<void> {
  await runCommandAsync({
    args: ['install', '--linker=hoisted', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: workspaceRoot,
    label: 'Create generated workspace lockfile',
  });
}

function resolveAcceptanceScreen(manifest: AppManifest): ScreenSpec {
  const { navigator, screens } = manifest;
  const initialRoute = navigator.routes.find((route) => route.name === navigator.initialRouteName);
  const screen = initialRoute?.screenId ? screens[initialRoute.screenId] : undefined;
  if (!screen) throw new Error('Generated acceptance template has no initial routed screen.');
  return screen;
}

async function runAcceptanceChecksAsync(projectRoot: string): Promise<void> {
  const commands: readonly AcceptanceCommand[] = [
    {
      args: ['install', '--frozen-lockfile', '--linker=hoisted'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Cold frozen install',
    },
    { args: ['run', 'lint'], command: 'bun', cwd: projectRoot, label: 'Generated app lint' },
    {
      args: ['x', 'expo', 'install', '--check'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Expo dependency compatibility',
    },
    { args: ['run', 'doctor'], command: 'bun', cwd: projectRoot, label: 'Expo Doctor' },
    { args: ['run', 'typecheck'], command: 'bun', cwd: projectRoot, label: 'TypeScript 6' },
    {
      args: ['x', 'react-compiler-healthcheck@latest'],
      command: 'bun',
      cwd: projectRoot,
      label: 'React Compiler healthcheck',
    },
    {
      args: ['run', 'export:web', '--', '--clear'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Static Web export',
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
      cwd: projectRoot,
      label: 'Android JavaScript export',
    },
    {
      args: ['x', 'expo', 'export', '--platform', 'ios', '--output-dir', 'dist-ios', '--clear'],
      command: 'bun',
      cwd: projectRoot,
      label: 'iOS JavaScript export',
    },
    {
      args: ['x', 'expo', 'prebuild', '--clean', '--no-install'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Clean CNG prebuild',
    },
  ];

  for (const command of commands) await runCommandAsync(command);
}

async function runCommandAsync(options: AcceptanceCommand): Promise<void> {
  console.log(`\n==> ${options.label}`);
  const childProcess = Bun.spawn([options.command, ...options.args], {
    cwd: options.cwd,
    env: {
      ...Bun.env,
      CI: '1',
      TMPDIR: '/tmp',
    },
    stderr: 'inherit',
    stdout: 'inherit',
  });
  const exitCode = await childProcess.exited;
  if (exitCode !== 0) throw new Error(`${options.label} failed with exit code ${exitCode}.`);
}

interface AcceptanceCommand {
  readonly args: readonly string[];
  readonly command: string;
  readonly cwd: string;
  readonly label: string;
}
