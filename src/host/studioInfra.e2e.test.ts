import { execFile as execFileCallback } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import {
  ensureProjectInfraPortForward,
  runProjectInfraScript,
  stopAllProjectInfraPortForwards,
} from './orchestrator/infraRuntime';
import { ProjectManager } from './orchestrator/projectManager';
import { upProjectInfrastructure } from './orchestrator/studioInfraUp';
import type { TrustedOAuthSecretResolver } from './secrets/trustedOAuthInfraEnvironment';

const execFile = promisify(execFileCallback);
const infraE2eTest = process.env.ANKH_STUDIO_INFRA_E2E === '1' ? test : test.skip;
const TEST_TIMEOUT_MS = 1_800_000;
const HTTP_TIMEOUT_MS = 60_000;

interface HostPorts {
  readonly app: number;
  readonly gateway: number;
  readonly studio: number;
  readonly db: number;
}

interface E2eProject {
  readonly dockerImage: string;
  readonly projectId: string;
  readonly projectPath: string;
  readonly ports: HostPorts;
}

const fakeGoogleOAuthCredentials = {
  clientId: 'fake-google-client-id',
  clientSecret: 'fake-google-client-secret',
} as const;

infraE2eTest(
  'orchestrates generated Infra 1.0.0 for two Supabase-backed projects',
  async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-studio-infra-e2e-'));
    const [firstPorts, secondPorts] = await reserveHostPortSets(2);
    if (!firstPorts || !secondPorts) throw new Error('Expected two reserved host port sets.');

    await createWorkspace(workspaceRoot);
    const projectManager = new ProjectManager(workspaceRoot);
    const first = await createE2eProject({
      workspaceRoot,
      projectManager,
      projectId: 'studio-e2e-a',
      ports: firstPorts,
      oauth: false,
    });
    const second = await createE2eProject({
      workspaceRoot,
      projectManager,
      projectId: 'studio-e2e-b',
      ports: secondPorts,
      oauth: true,
    });

    try {
      await upThroughStudio({ workspaceRoot, projectManager, project: first });
      const initialSecondUp = await upThroughStudio({
        workspaceRoot,
        projectManager,
        project: second,
        secretResolver: createOAuthSecretResolver(fakeGoogleOAuthCredentials),
      });
      expect(initialSecondUp.trustedOAuth.deferred).toBe(false);
      await saveFakeOAuthCredentialsToVault({
        workspaceRoot,
        projectId: second.projectId,
      });

      await expectProfileOwnsNamespaces(first.projectId);
      await expectProfileOwnsNamespaces(second.projectId);
      await expectNoHostSupabaseComposeContainersFor(first.projectId, second.projectId);
      expect(first.ports.app).not.toBe(second.ports.app);

      await expectOAuthRuntimeSecret(second.projectId, {
        clientId: fakeGoogleOAuthCredentials.clientId,
        clientSecret: fakeGoogleOAuthCredentials.clientSecret,
      });
      expect(
        await readFile(path.join(second.projectPath, 'infra', 'minikube', '.env'), 'utf8'),
      ).not.toContain(fakeGoogleOAuthCredentials.clientSecret);

      const firstLaunch = await ensureProjectInfraPortForward({
        rootPath: workspaceRoot,
        projectId: first.projectId,
        target: 'minikube',
      });
      const firstLaunchAgain = await ensureProjectInfraPortForward({
        rootPath: workspaceRoot,
        projectId: first.projectId,
        target: 'minikube',
      });
      expect(firstLaunch.url).toBe(`http://127.0.0.1:${first.ports.app}`);
      expect(firstLaunchAgain).toEqual({ url: firstLaunch.url, started: false });
      await expectReachable(firstLaunch.url, first.projectId);
      await expectForwardStatus(workspaceRoot, first.projectId, [
        'app: running',
        'supabase-gateway: running',
      ]);
      await expectForwardStatus(workspaceRoot, second.projectId, [
        'app: running',
        'supabase-gateway: running',
      ]);

      await runProjectInfraScript({
        rootPath: workspaceRoot,
        projectId: second.projectId,
        target: 'minikube',
        script: 'down',
      });
      const restartedSecondUp = await upThroughStudio({
        workspaceRoot,
        projectManager,
        project: second,
        secretResolver: createUnavailableSecretResolver(),
      });
      expect(restartedSecondUp.trustedOAuth.deferred).toBe(true);
      await expectReachable(firstLaunch.url, first.projectId);
      await expectReachable(`http://127.0.0.1:${second.ports.app}`, second.projectId);
      await expectOAuthRuntimeSecret(second.projectId, {
        clientId: fakeGoogleOAuthCredentials.clientId,
        clientSecret: fakeGoogleOAuthCredentials.clientSecret,
      });
      expect(
        await readFile(path.join(second.projectPath, 'infra', 'minikube', '.env'), 'utf8'),
      ).not.toContain(fakeGoogleOAuthCredentials.clientSecret);

      await projectManager.deleteProject(first.projectId);
      await expectProfileDeleted(first.projectId);
      await expectReachable(`http://127.0.0.1:${second.ports.app}`, second.projectId);

      await stopAllProjectInfraPortForwards();
      await expectForwardStatus(workspaceRoot, second.projectId, [
        'app: stopped',
        'supabase-gateway: stopped',
      ]);
      await expectProfileExists(second.projectId);
    } finally {
      await Promise.allSettled([
        stopAllProjectInfraPortForwards(),
        destroyIfPresent(workspaceRoot, first.projectId),
        destroyIfPresent(workspaceRoot, second.projectId),
        removeDockerImage(first.dockerImage),
        removeDockerImage(second.dockerImage),
      ]);
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  },
  TEST_TIMEOUT_MS,
);

async function createWorkspace(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio-e2e', private: true, workspaces: ['apps/*'] }),
  );
}

async function createE2eProject(args: {
  readonly workspaceRoot: string;
  readonly projectManager: ProjectManager;
  readonly projectId: string;
  readonly ports: HostPorts;
  readonly oauth: boolean;
}): Promise<E2eProject> {
  const projectPath = path.join(args.workspaceRoot, 'apps', args.projectId);
  const dockerImage = `ankh/${args.projectId}:studio-e2e`;
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({ name: `@${args.projectId}/app` }),
  );
  await writeFile(
    path.join(projectPath, 'ankh.config.json'),
    JSON.stringify(createManifest(args.projectId, args.oauth)),
  );
  await args.projectManager.regenerateInfrastructure(args.projectId);

  const exportRoot = path.join(projectPath, '.ankh', 'web-export');
  await mkdir(exportRoot, { recursive: true });
  await writeFile(path.join(exportRoot, 'index.html'), `<h1>${args.projectId}</h1>\n`);
  const minikubeRoot = path.join(projectPath, 'infra', 'minikube');
  await execFile(
    'docker',
    [
      'build',
      '-t',
      dockerImage,
      '-f',
      path.join(minikubeRoot, 'app-image', 'Dockerfile'),
      exportRoot,
    ],
    { timeout: 180_000 },
  );

  await writeFile(
    path.join(minikubeRoot, '.env'),
    [
      `ANKH_APP_SLUG=${args.projectId}`,
      `APP_IMAGE=${dockerImage}`,
      'APP_BUILD_ENABLED=false',
      'APP_WEB_EXPORT_DIR=.ankh/web-export',
      'APP_IMAGE_SYNC_STRATEGY=docker-load',
      `APP_PORT_FORWARD_LOCAL_PORT=${args.ports.app}`,
      `SUPABASE_GATEWAY_FORWARD_LOCAL_PORT=${args.ports.gateway}`,
      `SUPABASE_STUDIO_FORWARD_LOCAL_PORT=${args.ports.studio}`,
      `SUPABASE_DB_FORWARD_LOCAL_PORT=${args.ports.db}`,
      '',
    ].join('\n'),
  );

  for (const script of ['up.sh', 'down.sh', 'destroy.sh', 'port-forward.sh']) {
    await chmod(path.join(minikubeRoot, 'scripts', script), 0o755);
  }

  return {
    dockerImage,
    projectId: args.projectId,
    projectPath,
    ports: args.ports,
  };
}

async function upThroughStudio(args: {
  readonly workspaceRoot: string;
  readonly projectManager: ProjectManager;
  readonly project: E2eProject;
  readonly secretResolver?: TrustedOAuthSecretResolver;
}) {
  return upProjectInfrastructure({
    workspaceRoot: args.workspaceRoot,
    projectManager: args.projectManager,
    projectId: args.project.projectId,
    ...(args.secretResolver ? { secretResolver: args.secretResolver } : {}),
  });
}

async function saveFakeOAuthCredentialsToVault(args: {
  readonly workspaceRoot: string;
  readonly projectId: string;
}): Promise<void> {
  const dbUrl = await resolveGeneratedDbUrl(args.workspaceRoot, args.projectId);
  const secretRef = 'auth/oauth/google';
  const payload = JSON.stringify(fakeGoogleOAuthCredentials);
  const sql = `
with created as (
  select vault.create_secret('${escapeSqlLiteral(payload)}', '${escapeSqlLiteral(
    secretRef,
  )}', 'Generated Studio Infra E2E OAuth credential')::uuid as id
)
insert into ankh_secret_store.secret_metadata (
  project_id, environment, secret_ref, vault_secret_id, kind, provider, configured_fields
)
select '${escapeSqlLiteral(args.projectId)}', 'local', '${escapeSqlLiteral(
    secretRef,
  )}', id, 'oauth', 'google', array['clientId', 'clientSecret']::text[]
from created
on conflict (project_id, environment, secret_ref) do update
  set vault_secret_id = excluded.vault_secret_id,
      kind = excluded.kind,
      provider = excluded.provider,
      configured_fields = excluded.configured_fields,
      updated_at = now();
`;
  await execFile('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], {
    timeout: 60_000,
  });

  const resolved = await execFile(
    'psql',
    [
      dbUrl,
      '-v',
      'ON_ERROR_STOP=1',
      '-Atq',
      '-c',
      `select decrypted.decrypted_secret::jsonb ->> 'clientSecret'
       from ankh_secret_store.secret_metadata metadata
       join vault.decrypted_secrets decrypted on decrypted.id = metadata.vault_secret_id
       where metadata.project_id = '${escapeSqlLiteral(args.projectId)}'
         and metadata.environment = 'local'
         and metadata.secret_ref = '${escapeSqlLiteral(secretRef)}'
       limit 1;`,
    ],
    { timeout: 60_000 },
  );
  expect(resolved.stdout.trim()).toBe(fakeGoogleOAuthCredentials.clientSecret);
}

function createOAuthSecretResolver(
  payload: typeof fakeGoogleOAuthCredentials,
): TrustedOAuthSecretResolver {
  return {
    resolve: () =>
      Promise.resolve({
        ok: true,
        data: payload,
      }),
  };
}

function createUnavailableSecretResolver(): TrustedOAuthSecretResolver {
  return {
    resolve: () =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'unavailable',
          message: 'local Supabase Vault is stopped',
        },
      }),
  };
}

async function resolveGeneratedDbUrl(workspaceRoot: string, projectId: string): Promise<string> {
  const infraRoot = path.join(workspaceRoot, 'apps', projectId, 'infra', 'minikube');
  const env = new Map<string, string>();
  for (const fileName of ['.env.example', '.env']) {
    const filePath = path.join(infraRoot, fileName);
    const content = await readFile(filePath, 'utf8').catch(() => '');
    for (const line of content.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index <= 0) continue;
      env.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
    }
  }

  const port = env.get('SUPABASE_DB_FORWARD_LOCAL_PORT');
  const password = env.get('POSTGRES_PASSWORD');
  if (!port || !password) {
    throw new Error(`Generated Infra for ${projectId} did not provide DB port/password env.`);
  }

  return `postgres://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres?sslmode=disable`;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/gu, "''");
}

async function expectProfileOwnsNamespaces(profile: string): Promise<void> {
  await expectProfileExists(profile);
  for (const namespace of ['app', 'supabase']) {
    const result = await execFile(
      'kubectl',
      ['--context', profile, 'get', 'namespace', namespace, '-o', 'name'],
      {
        timeout: 60_000,
      },
    );
    expect(result.stdout.trim()).toBe(`namespace/${namespace}`);
  }
}

async function expectProfileExists(profile: string): Promise<void> {
  const result = await execFile('minikube', ['profile', 'list', '-o', 'json'], { timeout: 60_000 });
  expect(result.stdout).toContain(`"Name":"${profile}"`);
}

async function expectProfileDeleted(profile: string): Promise<void> {
  const result = await execFile('minikube', ['profile', 'list', '-o', 'json'], { timeout: 60_000 });
  expect(result.stdout).not.toContain(`"Name":"${profile}"`);
}

async function expectNoHostSupabaseComposeContainersFor(...projectIds: string[]): Promise<void> {
  const result = await execFile('docker', ['ps', '--format', '{{.Names}}'], { timeout: 60_000 });
  const names = result.stdout.split(/\r?\n/u).filter(Boolean);
  for (const projectId of projectIds) {
    expect(names.some((name) => name.startsWith('supabase_') && name.includes(projectId))).toBe(
      false,
    );
  }
}

async function expectOAuthRuntimeSecret(
  profile: string,
  expected: { readonly clientId: string; readonly clientSecret: string },
): Promise<void> {
  const result = await execFile(
    'kubectl',
    [
      '--context',
      profile,
      '-n',
      'supabase',
      'get',
      'secret',
      'supabase-runtime-secrets',
      '-o',
      'json',
    ],
    { timeout: 60_000 },
  );
  const parsed = JSON.parse(result.stdout) as { data?: Record<string, string> };
  expect(decodeBase64(parsed.data?.GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID)).toBe(expected.clientId);
  expect(decodeBase64(parsed.data?.GOTRUE_EXTERNAL_GOOGLE_SECRET)).toBe(expected.clientSecret);
}

async function expectForwardStatus(
  workspaceRoot: string,
  projectId: string,
  expectedLines: readonly string[],
): Promise<void> {
  const scriptPath = path.join(
    workspaceRoot,
    'apps',
    projectId,
    'infra',
    'minikube',
    'scripts',
    'port-forward.sh',
  );
  const output = await execFile('bash', [scriptPath, 'status', 'all'], { timeout: 60_000 });
  for (const line of expectedLines) {
    expect(output.stdout).toContain(line);
  }
}

async function expectReachable(url: string, expectedBody: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  expect(response.ok).toBe(true);
  expect(await response.text()).toContain(expectedBody);
}

async function destroyIfPresent(workspaceRoot: string, projectId: string): Promise<void> {
  const scriptPath = path.join(
    workspaceRoot,
    'apps',
    projectId,
    'infra',
    'minikube',
    'scripts',
    'destroy.sh',
  );
  try {
    await readFile(scriptPath, 'utf8');
  } catch {
    return;
  }
  await runProjectInfraScript({
    rootPath: workspaceRoot,
    projectId,
    target: 'minikube',
    script: 'destroy',
  }).catch(() => undefined);
}

async function removeDockerImage(image: string): Promise<void> {
  await execFile('docker', ['image', 'rm', image], { timeout: 60_000 }).catch(() => undefined);
}

async function reserveHostPortSets(count: number): Promise<HostPorts[]> {
  const servers = await Promise.all(
    Array.from({ length: count * 4 }, () => listenOnEphemeralPort()),
  );
  try {
    const ports = servers.map((server) => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP address.');
      return address.port;
    });
    if (new Set(ports).size !== ports.length) {
      throw new Error('Expected every Studio Infra E2E host port to be unique.');
    }
    return Array.from({ length: count }, (_, index) => {
      const offset = index * 4;
      const app = ports[offset];
      const gateway = ports[offset + 1];
      const studio = ports[offset + 2];
      const db = ports[offset + 3];
      if (!app || !gateway || !studio || !db) throw new Error('Expected complete host port set.');
      return { app, gateway, studio, db };
    });
  } finally {
    await Promise.all(servers.map(closeServer));
  }
}

async function listenOnEphemeralPort(): Promise<Server> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function decodeBase64(value: string | undefined): string {
  if (!value) throw new Error('Expected base64-encoded secret value.');
  return Buffer.from(value, 'base64').toString('utf8');
}

function createManifest(projectId: string, oauth: boolean): AppManifest {
  return {
    metadata: {
      name: projectId,
      slug: projectId,
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
    infra: {
      deployment: {
        target: 'minikube',
        monitoring: false,
      },
      auth: {
        scope: 'global',
        provider: 'supabase',
        ...(oauth
          ? {
              oauth: {
                enabled: true,
                callbackRoute: '/auth/callback',
                providers: [
                  {
                    id: 'google' as const,
                    enabled: true,
                    credentialsRef: 'auth/oauth/google',
                  },
                ],
              },
            }
          : {}),
      },
      database: {
        provider: 'supabase',
        tier: 'dev',
      },
      storage: {
        provider: 'auto',
        buckets: ['avatars'],
      },
      secretStore: {
        provider: 'supabase-vault',
      },
      plugins: [],
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: {
          id: 'root',
          type: 'Page',
        },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}
