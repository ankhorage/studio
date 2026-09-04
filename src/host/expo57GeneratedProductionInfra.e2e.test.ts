import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { runProjectInfrastructureLifecycle } from '@ankhorage/infra/project';
import { expect, test } from 'bun:test';

import {
  ensureProjectWebLaunchSession,
  stopAllProjectInfraPortForwards,
} from './orchestrator/infraSession';
import { ProjectManager } from './orchestrator/projectManager';
import { upProjectInfrastructure } from './orchestrator/studioInfraUp';
import { assertNoBrowserErrors } from './smoke/assertNoBrowserErrors';
import { ChromeNavigationSession } from './smoke/ChromeNavigationSession';
import { createExpo57NavigationFixtureManifest } from './smoke/createExpo57NavigationFixtureManifest';
import { createSmokeProjectSource } from './smoke/createSmokeProjectSource';
import { createStaticExportServer } from './smoke/createStaticExportServer';
import { reserveTcpPortAsync } from './smoke/reserveTcpPortAsync';
import { resolveAppOwnedExpoCliAsync } from './smoke/resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './smoke/runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 1_800_000;
const execFile = promisify(execFileCallback);
const productionInfraTest = process.env.ANKH_STUDIO_EXPO57_INFRA_E2E === '1' ? test : test.skip;

productionInfraTest(
  'exports an Expo 57 generated app with its own CLI and serves that artifact through generated Infra',
  async () => {
    assertNode24();
    const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-production-infra-'));
    const manager = new ProjectManager(workspaceRoot);
    let projectId: string | null = null;

    try {
      await createWorkspaceAsync(workspaceRoot);
      const created = await manager.createProject(
        'Expo 57 Production Infra',
        createSmokeProjectSource(),
        undefined,
        { includeStudio: false },
      );
      projectId = created.id;
      const baseManifest = await manager.getProjectManifest(created.id);
      const {
        auth: _auth,
        database: _database,
        secretStore: _secretStore,
        storage: _storage,
        ...appOnlyInfra
      } = baseManifest.infra;
      await manager.saveProjectManifest({
        projectId: created.id,
        manifest: createExpo57NavigationFixtureManifest(
          { ...baseManifest, infra: appOnlyInfra },
          {
            auth: false,
            name: 'Expo 57 Production Infra',
            slug: created.id,
          },
        ),
        mutations: [],
      });

      await rm(path.join(workspaceRoot, 'package.json'));
      const lockfileDigest = await installFromCleanLockfileAsync(created.path);
      await resolveAppOwnedExpoCliAsync(created.path);
      await assertGeneratedBuildUsesAppOwnedExpoCliAsync(created.path);

      const ports = await reserveInfraPortsAsync();
      const image = `ankh/${created.id}:expo57-production-e2e`;
      await writeInfraEnvironmentAsync(created.path, created.id, image, ports);
      await upProjectInfrastructure({
        projectId: created.id,
        projectManager: manager,
        workspaceRoot,
      });

      const exportedIndex = path.join(created.path, '.ankh', 'web-export', 'index.html');
      expect((await readFile(exportedIndex, 'utf8')).length).toBeGreaterThan(0);
      await runLocalArtifactBrowserAcceptanceAsync(created.path);

      const launch = await ensureProjectWebLaunchSession({
        projectId: created.id,
        projectPath: created.path,
        target: 'minikube',
      });
      expect(launch.url).toBe(`http://127.0.0.1:${ports.app}`);
      await runProductionBrowserAcceptanceAsync(launch.url, 'generated Infra');
      await assertLockfileUnchangedAsync(created.path, lockfileDigest);
    } finally {
      await stopAllProjectInfraPortForwards().catch(() => undefined);
      if (projectId) {
        await runProjectInfrastructureLifecycle({
          projectId,
          projectPath: path.join(workspaceRoot, 'apps', projectId),
          target: 'minikube',
          script: 'destroy',
        }).catch(() => undefined);
        await execFile('docker', ['image', 'rm', `ankh/${projectId}:expo57-production-e2e`], {
          timeout: 60_000,
        }).catch(() => undefined);
      }
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  },
  COMMAND_TIMEOUT_MS,
);

function assertNode24(): void {
  if (!process.version.startsWith('v24.')) {
    throw new Error(`Node 24 LTS is required; received ${process.version}.`);
  }
}

async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-production-infra-acceptance',
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

async function installFromCleanLockfileAsync(projectRoot: string): Promise<string> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Create generated production Infra lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await Promise.all([
    rm(path.join(projectRoot, 'node_modules'), { force: true, recursive: true }),
    rm(path.join(projectRoot, '.expo'), {
      force: true,
      recursive: true,
    }),
    rm(path.join(projectRoot, '.ankh', 'web-export'), {
      force: true,
      recursive: true,
    }),
  ]);
  const digest = hash(await readFile(path.join(projectRoot, 'bun.lock')));
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Cold generated production Infra install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await assertLockfileUnchangedAsync(projectRoot, digest);
  return digest;
}

async function assertGeneratedBuildUsesAppOwnedExpoCliAsync(projectRoot: string): Promise<void> {
  const script = await readFile(
    path.join(projectRoot, 'infra', 'minikube', 'scripts', 'build-app-image.sh'),
    'utf8',
  );
  expect(script).toContain('node_modules/.bin/expo');
  expect(script).toContain('App-owned Expo CLI is missing:');
  expect(script).toContain('bun install --frozen-lockfile');
  expect(script).not.toMatch(/\bbunx?\s+(?:x\s+)?expo\b/u);
}

async function assertLockfileUnchangedAsync(
  projectRoot: string,
  expectedDigest: string,
): Promise<void> {
  expect(hash(await readFile(path.join(projectRoot, 'bun.lock')))).toBe(expectedDigest);
}

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

async function reserveInfraPortsAsync(): Promise<InfraPorts> {
  const [app, gateway, studio, database] = await Promise.all([
    reserveTcpPortAsync('generated Infra app'),
    reserveTcpPortAsync('generated Infra gateway'),
    reserveTcpPortAsync('generated Infra Studio'),
    reserveTcpPortAsync('generated Infra database'),
  ]);
  return { app, database, gateway, studio };
}

async function writeInfraEnvironmentAsync(
  projectRoot: string,
  projectId: string,
  image: string,
  ports: InfraPorts,
): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'infra', 'minikube', '.env'),
    [
      `ANKH_APP_SLUG=${projectId}`,
      'MINIKUBE_DRIVER=docker',
      'APP_BUILD_ENABLED=true',
      'APP_WEB_EXPORT_DIR=.ankh/web-export',
      `APP_IMAGE=${image}`,
      `__UNSAFE_EXPO_HOME_DIRECTORY=${path.join(projectRoot, '.ankh', 'expo-home')}`,
      'APP_IMAGE_SYNC_STRATEGY=docker-load',
      'APP_IMAGE_CLEANUP_ON_DESTROY=true',
      'APP_IMAGE_CLEANUP_MINIKUBE=true',
      'APP_IMAGE_CLEANUP_DOCKER=true',
      `APP_PORT_FORWARD_LOCAL_PORT=${ports.app}`,
      `SUPABASE_GATEWAY_FORWARD_LOCAL_PORT=${ports.gateway}`,
      `SUPABASE_STUDIO_FORWARD_LOCAL_PORT=${ports.studio}`,
      `SUPABASE_DB_FORWARD_LOCAL_PORT=${ports.database}`,
      '',
    ].join('\n'),
    'utf8',
  );
}

async function runLocalArtifactBrowserAcceptanceAsync(projectRoot: string): Promise<void> {
  const server = createStaticExportServer(projectRoot, '.ankh/web-export');
  try {
    if (server.port === undefined) throw new Error('Local production artifact server has no port.');
    await runProductionBrowserAcceptanceAsync(
      `http://127.0.0.1:${server.port}`,
      'local generated Infra artifact',
    );
  } finally {
    await server.stop(true);
  }
}

async function runProductionBrowserAcceptanceAsync(rootUrl: string, label: string): Promise<void> {
  const browser = await ChromeNavigationSession.createAsync(
    await reserveTcpPortAsync(`${label} Chrome`),
  );
  try {
    await browser.setViewportAsync(390, 844);
    await browser.navigateAsync(rootUrl);
    await browser.waitForBodyTextAsync('Navigation Home');
    await browser.waitForHydratedTestIdAsync('home-profile');
    await browser.assertNoHorizontalOverflowAsync(`${label} mobile layout`);
    await browser.clickByTestIdAsync('home-profile');
    await browser.waitForLocationAsync({ pathname: '/profile/ada', search: '?source=internal' });
    await browser.waitForBodyTextAsync('Dynamic Profile Route');
    await browser.setViewportAsync(1440, 900);
    await browser.assertNoHorizontalOverflowAsync(`${label} desktop layout`);
    assertNoBrowserErrors(browser.errors, label);
  } finally {
    browser.close();
  }
}

interface InfraPorts {
  readonly app: number;
  readonly database: number;
  readonly gateway: number;
  readonly studio: number;
}
