import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ProjectManager } from '../orchestrator/projectManager';
import { assertExpo57GeneratedCapabilityContractAsync } from './assertExpo57GeneratedCapabilityContractAsync';
import { assertExpo57GeneratedCapabilityNativePrebuildAsync } from './assertExpo57GeneratedCapabilityNativePrebuildAsync';
import { assertExpo57GeneratedCapabilityOwnerGraphAsync } from './assertExpo57GeneratedCapabilityOwnerGraphAsync';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { createExpo57CapabilityFixtureManifest } from './createExpo57CapabilityFixtureManifest';
import { createStaticExportServer } from './createStaticExportServer';
import { generateExpoRouterTypesAsync } from './generateExpoRouterTypesAsync';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 240_000;
const OAUTH_CLOCK_OFFSET_STORAGE_KEY = 'ankh.acceptance.oauth-clock-offset-ms';
const OAUTH_EXPIRED_CLOCK_OFFSET_MS = 11 * 60 * 1_000;
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
    path.join(workspaceRoot, 'bunfig.toml'),
    '[install]\nlinker = "hoisted"\n',
    'utf8',
  );
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
  await assertDevtoolsSyncIdempotentAsync(projectRoot);
  const sourceBeforeStaticChecks = await snapshotSourceTreeAsync(projectRoot);
  const setupCommands = [
    {
      args: ['run', 'format:check'],
      command: 'bun',
      label: 'Generated capability format check',
    },
    { args: ['run', 'lint'], command: 'bun', label: 'Generated capability project lint' },
    {
      args: ['x', 'expo', 'install', '--check'],
      command: 'bun',
      label: 'Generated capability Expo dependency compatibility',
    },
    { args: ['run', 'doctor'], command: 'bun', label: 'Generated capability Expo Doctor' },
  ] as const;
  for (const command of setupCommands) await runGeneratedCommandAsync(projectRoot, command);
  await assertSourceTreeUnchangedAsync(projectRoot, sourceBeforeStaticChecks);

  await generateExpoRouterTypesAsync({
    env: { EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED },
    label: 'Generated capability Expo Router typed-route generation',
    projectRoot,
    timeoutMs: 120_000,
  });
  await assertRouterTypesAsync(projectRoot);

  await runGeneratedCommandAsync(projectRoot, {
    args: ['run', 'typecheck'],
    command: 'bun',
    label: 'Generated capability TypeScript 6',
  });

  const authStub = createAuthStubServer();
  try {
    if (authStub.port === undefined) throw new Error('Capability Auth stub has no TCP port.');
    await runGeneratedCommandAsync(projectRoot, {
      args: ['x', 'expo', 'export', '--platform', 'web', '--clear'],
      command: 'bun',
      env: {
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'capability-acceptance-anon-key',
        EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authStub.port}`,
      },
      label: 'Generated capability Web export',
    });
    await runGeneratedCapabilityBrowserAcceptanceAsync(projectRoot, authStub);
  } finally {
    await authStub.stop(true);
  }

  const buildCommands = [
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

async function assertDevtoolsSyncIdempotentAsync(projectRoot: string): Promise<void> {
  const syncArgs = ['x', '@ankhorage/ankh', 'devtools', 'sync', '.'] as const;
  await runAcceptanceCommandAsync({
    args: syncArgs,
    command: 'bun',
    cwd: projectRoot,
    label: 'Generated capability Devtools sync',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  const secondSync = await runAcceptanceCommandAsync({
    args: syncArgs,
    captureOutput: true,
    command: 'bun',
    cwd: projectRoot,
    label: 'Generated capability idempotent Devtools sync',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  if (/\b(?:created|updated)\b/u.test(secondSync)) {
    throw new Error(`Second generated capability Devtools sync was not idempotent:\n${secondSync}`);
  }
}

function createAuthStubServer(): ReturnType<typeof Bun.serve> & {
  authorizationCount: number;
  tokenExchangeCount: number;
} {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      const corsHeaders = {
        'access-control-allow-headers':
          request.headers.get('access-control-request-headers') ??
          'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-origin': '*',
      };
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      if (pathname === '/favicon.ico')
        return new Response(null, { headers: corsHeaders, status: 204 });
      if (pathname === '/auth/v1/authorize') {
        server.authorizationCount += 1;
        return new Response('Deterministic OAuth provider handoff', { headers: corsHeaders });
      }
      if (pathname === '/auth/v1/token' && request.method === 'POST') {
        server.tokenExchangeCount += 1;
        return Response.json(
          {
            access_token: 'capability-browser-access-token',
            expires_in: 3600,
            refresh_token: 'capability-browser-refresh-token',
            token_type: 'bearer',
            user: {
              app_metadata: {},
              aud: 'authenticated',
              email: 'capability-browser@example.com',
              id: 'capability-browser-user',
              user_metadata: {},
            },
          },
          { headers: corsHeaders },
        );
      }
      return Response.json({ error: 'Unexpected acceptance Auth request.' }, { status: 404 });
    },
  }) as ReturnType<typeof Bun.serve> & {
    authorizationCount: number;
    tokenExchangeCount: number;
  };
  server.authorizationCount = 0;
  server.tokenExchangeCount = 0;
  return server;
}

async function runGeneratedCapabilityBrowserAcceptanceAsync(
  projectRoot: string,
  authStub: ReturnType<typeof createAuthStubServer>,
): Promise<void> {
  const staticServer = createStaticExportServer(projectRoot);
  let chrome: ChromeNavigationSession | null = null;
  try {
    if (staticServer.port === undefined)
      throw new Error('Capability static server has no TCP port.');
    const rootUrl = `http://127.0.0.1:${staticServer.port}`;
    chrome = await ChromeNavigationSession.createAsync(
      await reserveTcpPortAsync('capability Chrome debug'),
    );
    await chrome.installDateNowOffsetAsync(OAUTH_CLOCK_OFFSET_STORAGE_KEY);
    await chrome.installObservedBodyTextHistoryAsync();

    await chrome.navigateAsync(`${rootUrl}/sign-in`);
    await chrome.waitForBodyTextAsync('Sign in');
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Sign in');
    await chrome.reloadAsync();
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Sign in');

    await chrome.navigateAsync(`${rootUrl}/sign-up`);
    await chrome.waitForBodyTextAsync('Create account');
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Create account');
    await chrome.goBackAsync();
    await chrome.waitForLocationAsync({ pathname: '/sign-in' });
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Sign in');
    await chrome.goForwardAsync();
    await chrome.waitForLocationAsync({ pathname: '/sign-up' });
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Create account');

    await startBrowserOAuthAttemptAsync(chrome, rootUrl, authStub);
    await chrome.navigateAsync(`${rootUrl}/sign-in`);
    await chrome.setLocalStorageItemAsync(
      OAUTH_CLOCK_OFFSET_STORAGE_KEY,
      String(OAUTH_EXPIRED_CLOCK_OFFSET_MS),
    );
    await chrome.navigateAsync(`${rootUrl}/auth/callback?code=expired-code`);
    await chrome.waitForBodyTextAsync('The OAuth authorization attempt expired.');
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Return to sign in');
    await chrome.reloadAsync();
    await chrome.waitForBodyTextAsync(
      'The OAuth authorization attempt was not found or has expired.',
    );

    await startBrowserOAuthAttemptAsync(chrome, rootUrl, authStub);
    await chrome.navigateAsync(`${rootUrl}/auth/callback?code=replay-code`);
    await chrome.waitForLocationAsync({ pathname: '/' });
    await chrome.waitForBodyTextAsync('Camera access is required to scan barcodes.');
    await chrome.waitForHydratedTestIdAsync('capability-acceptance-scanner');

    const completedExchangeCount = authStub.tokenExchangeCount;
    if (completedExchangeCount !== 1) {
      throw new Error(
        `Generated OAuth completion performed ${completedExchangeCount} token exchange(s).`,
      );
    }

    await chrome.navigateAsync(`${rootUrl}/auth/callback?code=mismatched-code`);
    await chrome.waitForBodyTextAsync(
      'The OAuth callback does not match the completed authorization callback.',
    );
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Return to sign in');

    await chrome.navigateAsync(`${rootUrl}/auth/callback?code=replay-code`);
    await chrome.waitForObservedBodyTextAsync(
      'This OAuth callback was already completed. Continuing…',
    );
    await chrome.waitForLocationAsync({ pathname: '/' });
    await chrome.waitForHydratedTestIdAsync('capability-acceptance-scanner');
    await chrome.reloadAsync();
    await chrome.waitForHydratedTestIdAsync('capability-acceptance-scanner');

    if (authStub.tokenExchangeCount !== completedExchangeCount) {
      throw new Error(
        'Generated OAuth mismatched/replay browser evidence performed an additional token exchange.',
      );
    }
    assertNoBrowserErrors(chrome.errors, 'served generated Auth/capability export');
  } finally {
    chrome?.close();
    await staticServer.stop(true);
  }
}

async function startBrowserOAuthAttemptAsync(
  chrome: ChromeNavigationSession,
  rootUrl: string,
  authStub: ReturnType<typeof createAuthStubServer>,
): Promise<void> {
  const authorizationCountBefore = authStub.authorizationCount;
  await chrome.clearLocalStorageAsync();
  await chrome.setLocalStorageItemAsync(OAUTH_CLOCK_OFFSET_STORAGE_KEY, '0');
  await chrome.navigateAsync(`${rootUrl}/sign-in`);
  await chrome.waitForHydratedRoleAndNameAsync('button', 'Continue with Google');
  await chrome.clickByRoleAndNameAsync('button', 'Continue with Google');
  await chrome.waitForLocationAsync({ pathname: '/auth/v1/authorize' });
  await chrome.waitForBodyTextAsync('Deterministic OAuth provider handoff');
  if (authStub.authorizationCount !== authorizationCountBefore + 1) {
    throw new Error('Generated OAuth authorization did not reach the deterministic Auth stub.');
  }
}

async function snapshotSourceTreeAsync(projectRoot: string): Promise<Map<string, Uint8Array>> {
  const sourceRoot = path.join(projectRoot, 'src');
  const entries = await readdir(sourceRoot, { recursive: true });
  const files = new Map<string, Uint8Array>();
  for (const entry of entries.sort()) {
    const absolutePath = path.join(sourceRoot, entry);
    if (!(await stat(absolutePath)).isFile()) continue;
    files.set(entry, await readFile(absolutePath));
  }
  return files;
}

async function assertSourceTreeUnchangedAsync(
  projectRoot: string,
  expected: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  const actual = await snapshotSourceTreeAsync(projectRoot);
  if (actual.size !== expected.size) {
    throw new Error('Generated capability static checks changed the source file set.');
  }
  for (const [filePath, expectedContent] of expected) {
    const actualContent = actual.get(filePath);
    if (!actualContent || !Buffer.from(actualContent).equals(expectedContent)) {
      throw new Error(`Generated capability static checks changed source file ${filePath}.`);
    }
  }
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
  command: {
    readonly args: readonly string[];
    readonly command: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly label: string;
  },
): Promise<void> {
  await runAcceptanceCommandAsync({
    ...command,
    cwd: projectRoot,
    env: {
      EXPO_NO_TELEMETRY: '1',
      EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
      ...command.env,
    },
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}
