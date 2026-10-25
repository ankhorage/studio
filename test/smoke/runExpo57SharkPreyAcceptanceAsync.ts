import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { reserveTcpPort } from '@ankhorage/utility/node/net';

import { startStudioHostServer } from '../../src/host/http/server';
import { ProjectManager } from '../../src/host/orchestrator/projectManager';
import { getProjectTemplateSource } from '../../src/host/templates';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 300_000;
const HTTP_TIMEOUT_MS = 120_000;
const SHARKPREY_TEMPLATE = { category: 'education_learning', slug: 'sharkprey' } as const;
const BROWSER_ONLY = process.env.ANKH_STUDIO_SHARKPREY_BROWSER_ONLY === '1';

/***
 * Generate the released SharkPrey template with Studio, install the packed Studio candidate, and prove its untouched output passes every generated-app quality gate and boots in Chrome.
 */
export async function runExpo57SharkPreyAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-sharkprey-acceptance-'));
  const taskQueryFixture = createPokerTaskQueryFixture();
  let studioHost: Awaited<ReturnType<typeof startStudioHostServer>> | null = null;
  let expoProcess: ChildProcessWithoutNullStreams | null = null;
  let chrome: ChromeNavigationSession | null = null;

  try {
    await createWorkspaceAsync(workspaceRoot);
    const manager = new ProjectManager(workspaceRoot);
    const source = await getProjectTemplateSource(SHARKPREY_TEMPLATE);
    const project = await manager.createProject(
      'SharkPrey Acceptance',
      withPokerTaskQueryFixture(source, taskQueryFixture.baseUrl),
      undefined,
      {
        includeStudio: true,
      },
    );
    if (!BROWSER_ONLY) await runGeneratedPlatformContractAsync(project.path);
    const studioCandidate = await packCurrentStudioCandidateAsync(workspaceRoot);
    await installStudioCandidateAsync(project.path, studioCandidate);
    const lockfile = await createFrozenProjectInstallationAsync(project.path);
    await logResolvedSharkPreyDependenciesAsync(project.path);
    await assertGeneratedModuleBoundariesAsync(project.path);
    if (!BROWSER_ONLY) await runGeneratedQualityGatesAsync(project.path);
    await assertUnchangedLockfileAsync(project.path, lockfile);
    if (!BROWSER_ONLY) await runGeneratedPlatformBuildsAsync(project.path);
    await assertUnchangedLockfileAsync(project.path, lockfile);
    if (BROWSER_ONLY) await instrumentBrowserOnlyRuntimeAsync(project.path);

    const browser = await startGeneratedAppAsync({ projectRoot: project.path, workspaceRoot });
    studioHost = browser.studioHost;
    expoProcess = browser.expoProcess;
    chrome = browser.chrome;
    taskQueryFixture.assertExpectedQueries();
  } finally {
    chrome?.close();
    if (expoProcess) stopProcess(expoProcess);
    await studioHost?.close();
    taskQueryFixture.stop(true);
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

/*** Replace only the external poker API origin with the browser acceptance fixture; the published task bindings remain untouched. */
function withPokerTaskQueryFixture(
  source: Awaited<ReturnType<typeof getProjectTemplateSource>>,
  baseUrl: string,
): Awaited<ReturnType<typeof getProjectTemplateSource>> {
  const pokerTraining = source.manifest.infra.apis?.['poker-training'];
  if (!pokerTraining || pokerTraining.origin !== 'external' || pokerTraining.protocol !== 'rest') {
    throw new Error('SharkPrey template is missing its REST poker-training API.');
  }
  return {
    ...source,
    manifest: {
      ...source.manifest,
      infra: {
        ...source.manifest.infra,
        apis: {
          ...source.manifest.infra.apis,
          'poker-training': { ...pokerTraining, baseUrl },
        },
      },
    },
  };
}

/*** Create the isolated parent workspace that makes the generated app prove its own dependency and lockfile ownership. */
async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify({ name: '@ankhorage/sharkprey-acceptance', packageManager: 'bun@1.4.2', private: true }, null, 2)}\n`,
    'utf8',
  );
}

/*** Build and package the current checkout so the generated app exercises the candidate instead of a previously released Studio version. */
async function packCurrentStudioCandidateAsync(workspaceRoot: string): Promise<string> {
  const artifactRoot = path.join(workspaceRoot, '.ankh', 'acceptance-artifacts');
  const tarballPath = path.join(artifactRoot, 'studio-candidate.tgz');
  await mkdir(artifactRoot, { recursive: true });
  await runAcceptanceCommandAsync({
    args: ['run', 'build'],
    command: 'bun',
    cwd: process.cwd(),
    label: 'Build SharkPrey Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await runAcceptanceCommandAsync({
    args: ['pm', 'pack', '--filename', tarballPath, '--ignore-scripts', '--quiet'],
    command: 'bun',
    cwd: process.cwd(),
    label: 'Pack SharkPrey Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  return tarballPath;
}

/*** Replace only the acceptance app's Studio dependency with the explicitly packed local candidate. */
async function installStudioCandidateAsync(
  projectRoot: string,
  studioCandidate: string,
): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies: Record<string, string>;
  };
  packageJson.dependencies['@ankhorage/studio'] = `file:${studioCandidate}`;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

/*** Create an app-owned cross-platform lockfile, then perform the untouched app's required cold frozen installation. */
async function createFrozenProjectInstallationAsync(projectRoot: string): Promise<Uint8Array> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Create SharkPrey app lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await rm(path.join(projectRoot, 'node_modules'), { force: true, recursive: true });
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Cold frozen SharkPrey app install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  return readFile(path.join(projectRoot, 'bun.lock'));
}

/*** Assert that generator ownership creates the extracted root, Studio, and runtime shells without restoring obsolete root-layout implementation details. */
async function assertGeneratedModuleBoundariesAsync(projectRoot: string): Promise<void> {
  const generatedRoot = path.join(projectRoot, 'src', 'generated');
  const modules = await Promise.all([
    readFile(path.join(projectRoot, 'src', 'app', '_layout.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'rootShell.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'runtimeShell.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'studioAppHeader.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'studioShell.tsx'), 'utf8'),
  ]);
  const [layout, rootShell, runtimeShell, studioAppHeader, studioShell] = modules;
  for (const [name, source, required] of [
    ['root layout', layout, 'GeneratedRootShell'],
    ['root shell', rootShell, 'ExpoZoraIconFontProvider'],
    ['runtime shell', runtimeShell, 'RuntimeRendererConfigProvider'],
    ['Studio app header', studioAppHeader, 'StudioAppHeader'],
    ['Studio shell', studioShell, 'StudioAppHeader'],
  ] as const) {
    if (!source.includes(required))
      throw new Error(`Generated SharkPrey ${name} is missing ${required}.`);
  }
  if (layout.includes('useGlobalSearchParams') || layout.includes('useMemo')) {
    throw new Error(
      'Generated SharkPrey root layout restored obsolete route-search or memo dependencies.',
    );
  }
}

/*** Verify the untouched generated package declares only standalone-compatible dependency ranges before candidate installation. */
async function runGeneratedPlatformContractAsync(projectRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['run', 'platform:check'],
    command: 'bun',
    cwd: projectRoot,
    env: expoEnvironment(projectRoot),
    label: 'SharkPrey platform:check',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Run static generated-app gates without changing generated source; lint is configured to reject warnings as well as errors. */
async function runGeneratedQualityGatesAsync(projectRoot: string): Promise<void> {
  const commands = [
    ['run', 'typecheck'],
    ['run', 'lint'],
    ['run', 'format:check'],
    ['run', 'knip:check'],
    ['run', 'doctor'],
  ] as const;
  for (const args of commands) {
    await runAcceptanceCommandAsync({
      args: [...args],
      command: 'bun',
      cwd: projectRoot,
      env: expoEnvironment(projectRoot),
      label: `SharkPrey ${args[1]}`,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

/*** Export the generated application for every JavaScript target and perform clean native project materialization. */
async function runGeneratedPlatformBuildsAsync(projectRoot: string): Promise<void> {
  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);
  for (const args of [
    ['export', '--platform', 'web', '--output-dir', 'dist-web', '--clear'],
    ['export', '--platform', 'ios', '--output-dir', 'dist-ios', '--clear'],
    ['export', '--platform', 'android', '--output-dir', 'dist-android', '--clear'],
    ['prebuild', '--clean', '--no-install'],
  ] as const) {
    await runAcceptanceCommandAsync({
      args: [...args],
      command: expoCli,
      cwd: projectRoot,
      label: `SharkPrey Expo ${args[0]} ${args[2] ?? ''}`.trim(),
      env: expoEnvironment(projectRoot),
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

/*** Start Studio and Expo Web, then prove SharkPrey's nested Headless Tabs navigate through real Navigator controls in Chrome. */
async function startGeneratedAppAsync(args: {
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}): Promise<{
  readonly chrome: ChromeNavigationSession;
  readonly expoProcess: ChildProcessWithoutNullStreams;
  readonly studioHost: Awaited<ReturnType<typeof startStudioHostServer>>;
}> {
  await mkdir(path.join(args.projectRoot, '.ankh', 'metro-tmp'), { recursive: true });
  const studioPort = await reserveTcpPort('SharkPrey Studio host');
  const studioHost = await startStudioHostServer({
    host: '127.0.0.1',
    port: studioPort,
    projectRoot: args.workspaceRoot,
  });
  const expoPort = await reserveTcpPort('SharkPrey Expo Web');
  const expoCli = await resolveAppOwnedExpoCliAsync(args.projectRoot);
  const output: string[] = [];
  const expoProcess = spawn(expoCli, ['start', '--web', '--port', String(expoPort), '--clear'], {
    cwd: args.projectRoot,
    detached: true,
    env: {
      ...expoEnvironment(args.projectRoot),
      EXPO_PUBLIC_API_URL: `http://127.0.0.1:${studioPort}/api`,
    },
  });
  collectProcessOutput(expoProcess, output);
  const url = `http://127.0.0.1:${expoPort}`;
  await waitForExpoHttpAsync(url, expoProcess, output);
  const chrome = await ChromeNavigationSession.createAsync(
    await reserveTcpPort('SharkPrey Chrome debug'),
  );
  await chrome.installObservedPathnameHistoryAsync();
  await chrome.installBrowserAcceptanceFetchTraceAsync();
  await chrome.navigateAsync(url);
  await chrome.waitForBodyTextAsync('Ready to train?');
  await chrome.waitForApplicationInteractiveAsync();
  await chrome.clickByRoleAndNameAsync('button', 'Preview');
  await chrome.waitForInteractiveRoleAndNameAsync('button', 'Edit');
  await chrome.clickByRoleAndNameAsync('button', 'Start training');
  await chrome.waitForLocationAsync({ pathname: '/training-setup' });
  await chrome.waitForBodyTextAsync('What do you want to train?');
  await assertGameCategoryNavigationAsync(chrome);
  await assertTrainingJourneyAsync(chrome);
  const historyTraceStart = (await chrome.readObservedPathnamesAsync()).length;
  try {
    await chrome.clickByTestIdAsync('navigator-tabs-item-history');
  } catch (error) {
    const diagnostics = await chrome.capturePageDiagnosticsAsync([
      'navigator-tabs-item-history',
      'navigator-tabs-item-(train)',
    ]);
    throw new Error(
      `SharkPrey History tab is unavailable after Preview activation. ${JSON.stringify(diagnostics)}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await chrome.waitForLocationAsync({ pathname: '/history' });
  await assertPreviewNavigationTraceAsync(chrome, historyTraceStart, '/history');
  await chrome.waitForBodyTextAsync('History');
  const trainingTraceStart = (await chrome.readObservedPathnamesAsync()).length;
  await chrome.clickByTestIdAsync('navigator-tabs-item-(train)');
  await chrome.waitForLocationAsync({ pathname: '/training-setup' });
  await assertPreviewNavigationTraceAsync(chrome, trainingTraceStart, '/training-setup');
  await chrome.waitForBodyTextAsync('What do you want to train?');
  await assertDirectDecisionTableNavigationAsync(chrome);
  assertNoBrowserErrors(chrome.errors, 'generated SharkPrey template');
  return { chrome, expoProcess, studioHost };
}

/*** Exercise SharkPrey's published setup flow and preserve every authored route query before its task-query result reaches the decision table. */
async function assertTrainingJourneyAsync(chrome: ChromeNavigationSession): Promise<void> {
  await chrome.clickByRoleAndNameAsync('radio', 'MTT');
  await chrome.waitForLocationAsync({
    pathname: '/training-setup/table',
    search: '?gameCategory=mtt',
  });
  await chrome.clickByRoleAndNameAsync('radio', '6-max');
  await chrome.waitForLocationAsync({
    pathname: '/training-setup/street',
    search: '?gameCategory=mtt&tableSize=6max',
  });
  await chrome.clickByRoleAndNameAsync('radio', 'Preflop');
  await chrome.waitForLocationAsync({
    pathname: '/training-setup/difficulty',
    search: '?gameCategory=mtt&tableSize=6max&street=preflop',
  });
  await assertDifficultyTaskQueriesAsync(chrome);
  await assertFailedTaskQueriesAsync(chrome);
}

/*** Prove Expo Router resolves SharkPrey's public Decision Table URL before the Runtime capability initiates the same transition. */
async function assertDirectDecisionTableNavigationAsync(
  chrome: ChromeNavigationSession,
): Promise<void> {
  const { taskId } = pokerTrainingDifficulties()[0] ?? {};
  if (!taskId) throw new Error('SharkPrey acceptance is missing a Level 1 task fixture.');
  const origin = await chrome.readOriginAsync();
  await chrome.navigateAsync(`${origin}/decision-table?taskId=${taskId}`);
  await chrome.waitForLocationAsync({ pathname: '/decision-table', search: `?taskId=${taskId}` });
  await chrome.waitForBodyTextAsync('Your decision');
}

/*** Exercise every authored difficulty Button through its real task-query capability and returned task route. */
async function assertDifficultyTaskQueriesAsync(chrome: ChromeNavigationSession): Promise<void> {
  for (const { difficulty, label, taskId } of pokerTrainingDifficulties()) {
    await chrome.clearBrowserAcceptanceTraceAsync();
    await chrome.recordBrowserAcceptanceTraceAsync({
      difficulty,
      kind: 'test-click',
      target: 'setup-difficulty',
    });
    await chrome.clickByRoleAndNameAsync('button', label);
    try {
      await chrome.waitForLocationAsync({
        pathname: '/decision-table',
        search: `?taskId=${taskId}`,
      });
    } catch (error) {
      throw new Error(
        `SharkPrey Level ${difficulty} browser trace: ${JSON.stringify(await chrome.readBrowserAcceptanceTraceAsync())}. Runtime capability instrumentation is disabled in full acceptance, so an absent HTTP entry does not establish that Runtime did not dispatch; rerun with ANKH_STUDIO_SHARKPREY_BROWSER_ONLY=1 for the isolated Runtime handoff trace. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await chrome.waitForBodyTextAsync('Your decision');
    await chrome.goBackAsync();
    await chrome.waitForLocationAsync({
      pathname: '/training-setup/difficulty',
      search: '?gameCategory=mtt&tableSize=6max&street=preflop',
    });
    if (difficulty === 5) continue;
  }
}

/*** Log the actual generated consumer versions that the frozen Bun lockfile selected for browser acceptance. */
async function logResolvedSharkPreyDependenciesAsync(projectRoot: string): Promise<void> {
  const lockfile = await readFile(path.join(projectRoot, 'bun.lock'), 'utf8');
  const dependencies = [
    '@ankhorage/contracts',
    '@ankhorage/navigator',
    '@ankhorage/runtime',
    '@ankhorage/zora',
  ] as const;
  const resolved = Object.fromEntries(
    dependencies.map((dependency) => [
      dependency,
      lockfile.match(new RegExp(`"${dependency}": \\["${dependency}@([^"]+)`))?.[1] ?? 'unresolved',
    ]),
  );
  console.info(`SharkPrey generated bun.lock: ${JSON.stringify(resolved)}`);
}

/*** Add disposable browser-only visibility to the generated Runtime capability chain without changing the packaged application. */
async function instrumentBrowserOnlyRuntimeAsync(projectRoot: string): Promise<void> {
  const runtimeShellPath = path.join(projectRoot, 'src', 'generated', 'runtimeShell.tsx');
  const runtimeActionRegistryPath = path.join(
    projectRoot,
    'node_modules',
    '@ankhorage',
    'runtime',
    'dist',
    'runtimeActionRegistry.js',
  );
  const runtimeBindingsPath = path.join(
    projectRoot,
    'node_modules',
    '@ankhorage',
    'runtime',
    'dist',
    'runtimeBindings.js',
  );
  const source = await readFile(runtimeShellPath, 'utf8');
  const traced = source
    .replace(
      'const APP_COMPONENT_REGISTRY = createComponentRegistry(',
      `type BrowserAcceptanceTraceEntry = Readonly<Record<string, unknown>>;

function recordBrowserAcceptanceTrace(entry: BrowserAcceptanceTraceEntry): void {
  const target = globalThis as typeof globalThis & {
    __ankhBrowserAcceptanceTrace?: BrowserAcceptanceTraceEntry[];
  };
  target.__ankhBrowserAcceptanceTrace ??= [];
  target.__ankhBrowserAcceptanceTrace.push(entry);
}

const APP_COMPONENT_REGISTRY = createComponentRegistry(`,
    )
    .replace(
      '  const generatedRuntimeConfig = useMemo(\n',
      `  const instrumentedExecuteCapability = useMemo(
    () => async (args: Parameters<typeof executeCapability>[0]) => {
      const result = await executeCapability(args);
      recordBrowserAcceptanceTrace({
        capability: args.capability,
        data: result.ok ? result.data : undefined,
        diagnostics: result.diagnostics ?? [],
        input: args.input,
        kind: args.capability === 'navigator.navigate' ? 'navigator.navigate' : 'capability',
        ok: result.ok,
      });
      return result;
    },
    [executeCapability],
  );
  const generatedRuntimeConfig = useMemo(\n`,
    )
    .replace(
      '      executeCapability,\n',
      `      executeCapability: instrumentedExecuteCapability,
      writeResultSlot: (slot, value) => {
        recordBrowserAcceptanceTrace({ kind: 'result-slot', slot, value });
      },
`,
    )
    .replace(
      '    [executeCapability, runtimeManifest.media?.assets],\n',
      '    [instrumentedExecuteCapability, runtimeManifest.media?.assets],\n',
    )
    .replace(
      `  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text: () => response.text(),
  };`,
      `  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text: async () => {
      const text = await response.text();
      recordBrowserAcceptanceTrace({
        kind: 'http',
        method: init.method,
        response: JSON.parse(text),
        status: response.status,
        url,
      });
      return text;
    },
  };`,
    );
  if (traced === source || !traced.includes('recordBrowserAcceptanceTrace')) {
    throw new Error('Could not install the browser-only SharkPrey Runtime trace.');
  }
  await writeFile(runtimeShellPath, traced, 'utf8');

  const runtimeActionRegistry = await readFile(runtimeActionRegistryPath, 'utf8');
  const dispatchMarker = 'export async function dispatchRuntimeComponentEvent(args) {';
  const tracedRuntimeActionRegistry = runtimeActionRegistry.replace(
    dispatchMarker,
    `${dispatchMarker}
    globalThis.__ankhBrowserAcceptanceTrace ??= [];
    globalThis.__ankhBrowserAcceptanceTrace.push({
        eventName: args.eventName,
        kind: 'dispatch',
        nodeId: args.node.id,
    });`,
  );
  if (tracedRuntimeActionRegistry === runtimeActionRegistry) {
    throw new Error('Could not install the browser-only SharkPrey Runtime dispatch trace.');
  }
  await writeFile(runtimeActionRegistryPath, tracedRuntimeActionRegistry, 'utf8');

  const runtimeBindings = await readFile(runtimeBindingsPath, 'utf8');
  const invocationMarker =
    'export async function executeRuntimeBindingInvocation(invocation, context, args = {}, diagnostics = []) {';
  const tracedRuntimeBindings = runtimeBindings.replace(
    invocationMarker,
    `${invocationMarker}
    globalThis.__ankhBrowserAcceptanceTrace ??= [];
    globalThis.__ankhBrowserAcceptanceTrace.push({
        capability: invocation.capability,
        hasExecutor: context.executeCapability !== undefined,
        kind: 'invocation',
    });`,
  );
  if (tracedRuntimeBindings === runtimeBindings) {
    throw new Error('Could not install the browser-only SharkPrey Runtime invocation trace.');
  }
  await writeFile(runtimeBindingsPath, tracedRuntimeBindings, 'utf8');
}

/*** Prove empty and failed task-query actions stay on setup and render Web diagnostics rather than falsely navigating. */
async function assertFailedTaskQueriesAsync(chrome: ChromeNavigationSession): Promise<void> {
  const location = {
    pathname: '/training-setup/difficulty',
    search: '?gameCategory=mtt&tableSize=6max&street=preflop',
  };
  const dialogCount = chrome.dialogs.length;
  await chrome.clearBrowserAcceptanceTraceAsync();
  await chrome.clickByRoleAndNameAsync('button', 'Level 4 · Advanced');
  try {
    await chrome.waitForNewDialogTextAsync('Action unavailable', dialogCount);
  } catch (error) {
    throw new Error(
      `SharkPrey empty task browser trace: ${JSON.stringify(await chrome.readBrowserAcceptanceTraceAsync())}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await chrome.waitForLocationAsync(location);
  if (chrome.dialogs.length === dialogCount) {
    throw new Error('Empty SharkPrey task results did not render a failed-action diagnostic.');
  }

  const failedDialogCount = chrome.dialogs.length;
  await chrome.clickByRoleAndNameAsync('button', 'Level 5 · Expert');
  await chrome.waitForNewDialogTextAsync('Action unavailable', failedDialogCount);
  await chrome.waitForLocationAsync(location);
}

/*** Prove each authored RadioGroup value emits ZORA's capability event and reaches the canonical table-size route. */
async function assertGameCategoryNavigationAsync(chrome: ChromeNavigationSession): Promise<void> {
  for (const { label, value } of [
    { label: 'MTT', value: 'mtt' },
    { label: 'Sit & Go', value: 'sng' },
    { label: 'Cash Game', value: 'cash' },
  ]) {
    await chrome.clickByRoleAndNameAsync('radio', label);
    await chrome.waitForLocationAsync({
      pathname: '/training-setup/table',
      search: `?gameCategory=${value}`,
    });
    await chrome.goBackAsync();
    await chrome.waitForLocationAsync({ pathname: '/training-setup' });
  }
}

/*** Serve the task selected by SharkPrey's own query binding and record its exact filter contract. */
function createPokerTaskQueryFixture() {
  const requestedUrls: string[] = [];
  const taskRequestsByDifficulty = new Map<string, number>();
  const corsHeaders = { 'access-control-allow-origin': '*' };
  const server = Bun.serve({
    fetch(request) {
      const url = new URL(request.url);
      requestedUrls.push(url.toString());
      if (url.pathname === '/training/tasks') {
        const difficulty = url.searchParams.get('difficulty');
        const count = (taskRequestsByDifficulty.get(difficulty ?? '') ?? 0) + 1;
        taskRequestsByDifficulty.set(difficulty ?? '', count);
        if (difficulty === '4' && count > 1) return Response.json([], { headers: corsHeaders });
        if (difficulty === '5' && count > 1)
          return new Response('Task fixture failure', { headers: corsHeaders, status: 500 });
        const task = pokerTrainingDifficulties().find(
          (candidate) => candidate.difficulty === Number(difficulty),
        );
        return Response.json(task ? [{ id: task.taskId }] : [], { headers: corsHeaders });
      }
      if (url.pathname.startsWith('/training/tasks/')) {
        const taskId = url.pathname.slice('/training/tasks/'.length);
        return Response.json(
          {
            options: [],
            task: { id: taskId, prompt: 'Fixture decision', street: 'preflop' },
          },
          { headers: corsHeaders },
        );
      }
      return new Response('Not found', { headers: corsHeaders, status: 404 });
    },
    hostname: '127.0.0.1',
    port: 0,
  });
  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    assertExpectedQueries() {
      const taskRequests = requestedUrls.filter(
        (url) => new URL(url).pathname === '/training/tasks',
      );
      for (const { difficulty } of pokerTrainingDifficulties()) {
        const request = taskRequests.find(
          (candidate) => new URL(candidate).searchParams.get('difficulty') === String(difficulty),
        );
        if (!request) throw new Error(`SharkPrey did not query difficulty ${difficulty}.`);
        const query = new URL(request).searchParams;
        for (const [name, value] of [
          ['gameCategory', 'mtt'],
          ['tableSize', '6max'],
          ['street', 'preflop'],
          ['difficulty', String(difficulty)],
          ['limit', '1'],
        ] as const) {
          if (query.get(name) !== value)
            throw new Error(`SharkPrey task query lost ${name}=${value}.`);
        }
      }
      if (
        (taskRequestsByDifficulty.get('4') ?? 0) < 2 ||
        (taskRequestsByDifficulty.get('5') ?? 0) < 2
      ) {
        throw new Error('SharkPrey did not execute the empty and failing task-query fixtures.');
      }
    },
    stop(force: boolean) {
      server.stop(force);
    },
  };
}

/*** Supply deterministic fixture task identities for every published SharkPrey difficulty. */
function pokerTrainingDifficulties() {
  return [
    {
      difficulty: 1,
      label: 'Level 1 · Fundamentals',
      taskId: '10000000-0000-4000-8000-000000000001',
    },
    {
      difficulty: 2,
      label: 'Level 2 · Standard spots',
      taskId: '10000000-0000-4000-8000-000000000002',
    },
    {
      difficulty: 3,
      label: 'Level 3 · Intermediate',
      taskId: '10000000-0000-4000-8000-000000000003',
    },
    { difficulty: 4, label: 'Level 4 · Advanced', taskId: '10000000-0000-4000-8000-000000000004' },
    { difficulty: 5, label: 'Level 5 · Expert', taskId: '10000000-0000-4000-8000-000000000005' },
  ] as const;
}

/*** Assert that one Preview-mode Navigator action reached its target without an auth redirect back to onboarding. */
async function assertPreviewNavigationTraceAsync(
  chrome: ChromeNavigationSession,
  start: number,
  expectedPathname: string,
): Promise<void> {
  const trace = (await chrome.readObservedPathnamesAsync()).slice(start);
  if (!trace.includes(expectedPathname) || trace.includes('/onboarding')) {
    throw new Error(
      `Preview navigation expected ${expectedPathname} without an onboarding redirect. Trace: ${trace.join(' -> ')}`,
    );
  }
}

/*** Supply safe deterministic generated-app environment values for static, native, and browser acceptance. */
function expoEnvironment(projectRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    __UNSAFE_EXPO_HOME_DIRECTORY: path.join(projectRoot, '.ankh', 'expo-home'),
    BROWSER: 'none',
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sharkprey-acceptance-anon-key',
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
    TMPDIR: path.join(projectRoot, '.ankh', 'metro-tmp'),
    NODE_ENV: 'development',
  };
}

/*** Verify every acceptance phase preserved the generated app's frozen lockfile bytes. */
async function assertUnchangedLockfileAsync(
  projectRoot: string,
  expected: Uint8Array,
): Promise<void> {
  const actual = await readFile(path.join(projectRoot, 'bun.lock'));
  if (!Buffer.from(actual).equals(expected))
    throw new Error('SharkPrey acceptance mutated its frozen generated lockfile.');
}

/*** Wait for Expo Web to accept requests and include process diagnostics if Metro exits before readiness. */
async function waitForExpoHttpAsync(
  url: string,
  expoProcess: ChildProcessWithoutNullStreams,
  output: readonly string[],
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HTTP_TIMEOUT_MS) {
    if (expoProcess.exitCode !== null || expoProcess.signalCode !== null)
      throw new Error(
        `SharkPrey Expo Web exited before ${url} became reachable.\n${output.join('').slice(-12_000)}`,
      );
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(
    `Timed out waiting for SharkPrey Expo Web at ${url}.\n${output.join('').slice(-12_000)}`,
  );
}

/*** Collect Expo process output so launch failures retain useful Metro diagnostics. */
function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

/*** Stop the detached Expo process group and any Metro children. */
function stopProcess(processToStop: ChildProcessWithoutNullStreams): void {
  if (!processToStop.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}
