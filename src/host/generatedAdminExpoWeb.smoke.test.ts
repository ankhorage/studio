import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest, UiNode } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import type { StudioModuleState } from '../moduleAdminContracts';
import {
  bunLockfileReferencesPackageVersion,
  isPathInsideResolved,
  resolveInstalledPackageProvenance,
} from './installedPackageProvenance';
import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';
import { satisfiesCaretSemverRange } from './orchestrator/semverRange';
import { getProjectTemplate, getTemplateCatalog } from './templateRegistry';

const adminWebSmokeTest = process.env.ANKH_STUDIO_ADMIN_WEB_SMOKE === '1' ? test : test.skip;
const TEST_TIMEOUT_MS = 240_000;
const HTTP_TIMEOUT_MS = 120_000;
const ROUTE_SETTLE_MS = 1_500;

interface ChromeJsonTarget {
  readonly webSocketDebuggerUrl: string;
}

interface ChromeProtocolMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
}

interface StudioScreenStateExpectation {
  readonly pathname: string;
  readonly activeScreenId: string;
  readonly rootNodeId: string;
}

interface StudioNavigationReadinessPage {
  readonly errors: readonly string[];
  isStudioNavigationReady(): Promise<boolean>;
  readStudioNavigationDiagnostics(expoOutput: readonly string[]): Promise<string>;
}

interface StudioScreenStatePage {
  readStudioScreenState(): Promise<string>;
  readStudioNavigationDiagnostics(expoOutput: readonly string[]): Promise<string>;
}

interface StudioNavigationInvocationPage {
  evaluate<T>(expression: string): Promise<T>;
  readStudioNavigationDiagnostics(expoOutput: readonly string[]): Promise<string>;
}

interface RuntimeNodeInteractionPage {
  readRuntimeNodeInteractionSnapshot(nodeId: string): Promise<RuntimeNodeInteractionSnapshot>;
  readStudioNavigationDiagnostics(expoOutput: readonly string[]): Promise<string>;
}

const SMOKE_NAVIGATION_PROBE_SOURCE = `export function SmokeNavigationProbe() {
  const router = useRouter();
  const studio = useStudio();

  useEffect(() => {
    if (studio.isLoading) return;

    type SmokeNavigate = (href: string, options?: { replace?: boolean }) => void;
    const smokeGlobal = globalThis as typeof globalThis & {
      __studioSmokeNavigate?: SmokeNavigate;
      __studioSmokeNavigationReady?: SmokeNavigate;
    };
    const navigate: SmokeNavigate = (href, options) => {
      if (options?.replace) {
        router.replace(href as never);
        return;
      }
      router.push(href as never);
    };
    smokeGlobal.__studioSmokeNavigate = navigate;
    smokeGlobal.__studioSmokeNavigationReady = navigate;
    return () => {
      if (smokeGlobal.__studioSmokeNavigate === navigate) {
        delete smokeGlobal.__studioSmokeNavigate;
      }
      if (smokeGlobal.__studioSmokeNavigationReady === navigate) {
        delete smokeGlobal.__studioSmokeNavigationReady;
      }
    };
  }, [router, studio.isLoading]);

  return null;
}`;

function createAdminSmokeManifest(): AppManifest {
  const nutritionManifest = getProjectTemplate({
    category: 'food_drink',
    templateId: 'nutrition-catalog-scan',
  });
  const catalogScreenId = 'food_drink-nutrition-catalog-scan-catalog';
  const catalogScreen = nutritionManifest.screens[catalogScreenId];
  if (!catalogScreen) throw new Error('Nutrition template is missing its catalog screen.');

  return {
    ...nutritionManifest,
    metadata: {
      ...nutritionManifest.metadata,
      name: 'Generated Admin Web Smoke',
      slug: 'generated-admin-web-smoke',
    },
    infra: {
      ...nutritionManifest.infra,
      auth: {
        scope: 'global',
        provider: 'supabase',
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          forgotPasswordRoute: 'forgot-password',
          postSignInRoute: 'products',
          unauthorizedRoute: 'sign-in',
        },
        signIn: { identifiers: ['email'] },
        oauth: {
          enabled: false,
          callbackRoute: '/auth/callback',
          providers: [],
        },
      },
    },
    navigator: {
      ...nutritionManifest.navigator,
      routes: [
        ...nutritionManifest.navigator.routes,
        {
          name: 'dashboard',
          label: 'Dashboard',
          screenId: 'dashboard',
          showInPrimaryNavigation: false,
        },
      ],
    },
    screens: {
      ...nutritionManifest.screens,
      [catalogScreenId]: {
        ...catalogScreen,
        root: {
          ...catalogScreen.root,
          children: [
            ...(catalogScreen.root.children ?? []),
            {
              id: 'nutrition-preview-navigation-action',
              type: 'Button',
              props: {
                children: 'Open scanner in Preview',
                onPress: { type: 'navigate', payload: { route: '/scan' } },
                testID: 'nutrition-preview-navigation-action',
              },
            },
            { id: 'nutrition-studio-smoke-probe', type: 'SmokeStudioProbe', props: {} },
          ],
        },
      },
      dashboard: {
        id: 'dashboard',
        name: 'Dashboard',
        root: createScrollableRuntimeScreenRoot(),
      },
    },
  };
}

function createScrollableRuntimeScreenRoot(): UiNode {
  return {
    id: 'dashboard-root',
    type: 'Screen',
    props: {
      scroll: true,
      width: 'wide',
    },
    children: [
      {
        id: 'dashboard-runtime-section',
        type: 'ScreenSection',
        props: {
          title: 'Scrollable Runtime Screen',
          description: 'Rendered through the generated-app runtime registry.',
        },
        children: [
          {
            id: 'desktop-pointer-parent',
            type: 'Box',
            props: {
              p: 'm',
              testID: 'desktop-pointer-parent',
            },
            children: [
              {
                id: 'desktop-pointer-target',
                type: 'Text',
                props: {
                  children: 'Desktop pointer target',
                  testID: 'desktop-pointer-target',
                },
              },
            ],
          },
          {
            id: 'unsupported-runtime-target',
            type: 'SmokeUnsupported',
            props: {
              label: 'Unsupported runtime target',
              testID: 'unsupported-runtime-target',
            },
          },
          {
            id: 'supported-runtime-neighbor',
            type: 'Text',
            props: {
              children: 'Supported runtime neighbor',
              testID: 'supported-runtime-neighbor',
            },
          },
          {
            id: 'studio-smoke-probe',
            type: 'SmokeStudioProbe',
            props: {},
          },
          {
            id: 'native-layout-fixture',
            type: 'Box',
            props: {
              testID: 'native-layout-fixture',
              style: { gap: 12 },
            },
            children: [
              {
                id: 'native-row-parent',
                type: 'SmokeLayoutBox',
                props: {
                  testID: 'native-row-parent',
                  style: {
                    alignItems: 'center',
                    flexDirection: 'row',
                    height: 72,
                    width: 320,
                  },
                },
                children: [
                  {
                    id: 'native-row-sibling-a',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Row A',
                      testID: 'native-row-sibling-a',
                      style: { height: 44, width: 70 },
                    },
                  },
                  {
                    id: 'native-row-target',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Row target',
                      stateful: true,
                      testID: 'native-row-target',
                      style: { height: 52, width: 130 },
                    },
                  },
                  {
                    id: 'native-row-sibling-b',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Row B',
                      testID: 'native-row-sibling-b',
                      style: { height: 40, width: 80 },
                    },
                  },
                ],
              },
              {
                id: 'native-flex-parent',
                type: 'SmokeLayoutBox',
                props: {
                  testID: 'native-flex-parent',
                  style: { flexDirection: 'row', height: 64, width: 320 },
                },
                children: [
                  {
                    id: 'native-flex-target',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Flex grow',
                      testID: 'native-flex-target',
                      style: { flexGrow: 1, height: 52 },
                    },
                  },
                  {
                    id: 'native-flex-sibling',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Fixed',
                      testID: 'native-flex-sibling',
                      style: { height: 52, width: 88 },
                    },
                  },
                ],
              },
              {
                id: 'native-align-parent',
                type: 'SmokeLayoutBox',
                props: {
                  testID: 'native-align-parent',
                  style: { height: 90, width: 320 },
                },
                children: [
                  {
                    id: 'native-align-target',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Align self',
                      testID: 'native-align-target',
                      style: { alignSelf: 'flex-end', height: 42, width: 140 },
                    },
                  },
                ],
              },
              {
                id: 'native-percentage-parent',
                type: 'SmokeLayoutBox',
                props: {
                  testID: 'native-percentage-parent',
                  style: { height: 60, width: 300 },
                },
                children: [
                  {
                    id: 'native-percentage-target',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Fifty percent',
                      testID: 'native-percentage-target',
                      style: { height: 44, width: '50%' },
                    },
                  },
                ],
              },
              {
                id: 'native-absolute-parent',
                type: 'SmokeLayoutBox',
                props: {
                  testID: 'native-absolute-parent',
                  style: { height: 110, position: 'relative', width: 320 },
                },
                children: [
                  {
                    id: 'native-absolute-sibling',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Flow sibling',
                      testID: 'native-absolute-sibling',
                      style: { height: 40, width: 100 },
                    },
                  },
                  {
                    id: 'native-absolute-target',
                    type: 'SmokeLayoutBox',
                    props: {
                      label: 'Absolute',
                      testID: 'native-absolute-target',
                      style: {
                        height: 52,
                        left: 150,
                        position: 'absolute',
                        top: 24,
                        width: 130,
                      },
                    },
                  },
                ],
              },
              {
                id: 'native-nested-scroll',
                type: 'SmokeNestedScroll',
                props: {
                  testID: 'native-nested-scroll',
                },
                children: [
                  ...Array.from({ length: 12 }, (_, index) => ({
                    id: `native-nested-scroll-row-${index}`,
                    type: 'SmokeLayoutBox',
                    props: {
                      label: `Nested row ${index + 1}`,
                      testID: `native-nested-scroll-row-${index}`,
                      style: { height: 64, width: 260 },
                    },
                  })),
                ],
              },
            ],
          },
          ...Array.from({ length: 16 }, (_, index) => ({
            id: `dashboard-runtime-row-${index}`,
            type: 'Text',
            props: {
              children: `Generated runtime row ${index + 1}`,
              testID: `dashboard-runtime-row-${index}`,
            },
          })),
        ],
      },
    ],
  };
}

test('native unsupported layout fixture covers layout-sensitive Runtime relationships', () => {
  const root = createScrollableRuntimeScreenRoot();
  const nodes = new Map<string, UiNode>();
  const visit = (node: UiNode): void => {
    nodes.set(node.id, node);
    node.children?.forEach(visit);
  };
  visit(root);

  expect(nodes.get('native-row-parent')?.children?.length).toBe(3);
  expect(nodes.get('native-flex-target')?.props?.style).toMatchObject({ flexGrow: 1 });
  expect(nodes.get('native-align-target')?.props?.style).toMatchObject({
    alignSelf: 'flex-end',
  });
  expect(nodes.get('native-percentage-target')?.props?.style).toMatchObject({
    width: '50%',
  });
  expect(nodes.get('native-absolute-target')?.props?.style).toMatchObject({
    position: 'absolute',
  });
  expect(nodes.get('native-row-target')?.props?.stateful).toBe(true);
  expect(nodes.get('native-nested-scroll')?.children?.length).toBe(12);
});

test('root-owned smoke navigation probe publishes readiness and cleans up only owned callbacks', () => {
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain('if (studio.isLoading) return;');
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain(
    'smokeGlobal.__studioSmokeNavigationReady = navigate;',
  );
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain(
    'if (smokeGlobal.__studioSmokeNavigate === navigate)',
  );
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain(
    'if (smokeGlobal.__studioSmokeNavigationReady === navigate)',
  );
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain('delete smokeGlobal.__studioSmokeNavigate;');
  expect(SMOKE_NAVIGATION_PROBE_SOURCE).toContain(
    'delete smokeGlobal.__studioSmokeNavigationReady;',
  );
});

test('navigation readiness timeout reports browser and process diagnostics', async () => {
  const page: StudioNavigationReadinessPage = {
    errors: ['browser exploded'],
    isStudioNavigationReady() {
      return Promise.resolve(false);
    },
    readStudioNavigationDiagnostics(expoOutput) {
      return Promise.resolve(`url=http://127.0.0.1/;pathname=/;expo=${expoOutput.join('')}`);
    },
  };

  try {
    await waitForStudioNavigationReady(page, 0, ['expo booting']);
    throw new Error('Expected navigation readiness to time out.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Timed out waiting for Studio navigation readiness');
    expect((error as Error).message).toContain('pathname=/');
    expect((error as Error).message).toContain('browser exploded');
    expect((error as Error).message).toContain('expo booting');
  }
});

test('navigation refuses unavailable callbacks instead of falling back to browser navigation', async () => {
  const page: StudioNavigationInvocationPage = {
    evaluate() {
      return Promise.resolve(false as never);
    },
    readStudioNavigationDiagnostics() {
      return Promise.resolve('url=http://127.0.0.1/;pathname=/;globals=[]');
    },
  };

  try {
    await invokeStudioNavigation(page, '/products', []);
    throw new Error('Expected unavailable Studio navigation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      'Studio smoke navigation is unavailable for /products',
    );
    expect((error as Error).message).toContain('pathname=/');
  }
});

test('screen-state readiness distinguishes root fallback from /products pathname matching', async () => {
  const rootState = {
    pathname: '/',
    activeScreenId: 'catalog',
    rootNodeId: 'products-root',
  } satisfies StudioScreenStateExpectation;
  const productsState = {
    ...rootState,
    pathname: '/products',
  } satisfies StudioScreenStateExpectation;
  const states = [formatStudioScreenState(rootState), formatStudioScreenState(productsState)];
  const page: StudioScreenStatePage = {
    readStudioScreenState() {
      return Promise.resolve(states.shift() ?? formatStudioScreenState(productsState));
    },
    readStudioNavigationDiagnostics() {
      return Promise.resolve('ready');
    },
  };

  await waitForStudioScreenState(page, rootState, 0, []);
  await waitForStudioScreenState(page, productsState, 100, [], () => Promise.resolve());
});

test('Runtime node readiness survives a hydration remount before returning stable geometry', async () => {
  const target = { left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 };
  const missing: RuntimeNodeInteractionSnapshot = {
    activeElement: null,
    hitElement: null,
    inputDisabled: false,
    inputExists: false,
    inputFocused: false,
    inputReadOnly: false,
    inputValue: null,
    target: null,
    wrapper: null,
    wrapperCount: 0,
  };
  const ready: RuntimeNodeInteractionSnapshot = {
    ...missing,
    hitElement: '<input>',
    inputExists: true,
    inputReadOnly: true,
    inputValue: '',
    target,
    wrapperCount: 1,
  };
  const snapshots = [ready, missing, ready, ready];
  const page: RuntimeNodeInteractionPage = {
    readRuntimeNodeInteractionSnapshot() {
      return Promise.resolve(snapshots.shift() ?? ready);
    },
    readStudioNavigationDiagnostics() {
      return Promise.resolve('ready');
    },
  };

  expect(
    await waitForRuntimeNodeInteractionReady(page, 'search-input', 400, [], () =>
      Promise.resolve(),
    ),
  ).toEqual(ready);
});

adminWebSmokeTest(
  'loads generated Studio admin routes through Expo web without a theme update loop',
  async () => {
    const rawPreservedWorkspaceRoot: unknown = process.env.ANKH_STUDIO_ADMIN_WEB_SMOKE_WORKSPACE;
    const preservedWorkspaceRoot =
      typeof rawPreservedWorkspaceRoot === 'string' && rawPreservedWorkspaceRoot.length > 0
        ? rawPreservedWorkspaceRoot
        : undefined;
    const workspaceRoot =
      preservedWorkspaceRoot ?? (await mkdtemp(path.join(tmpdir(), 'ankh-admin-web-smoke-')));
    const debugPort = await reservePort();
    let expoProcess: ChildProcessWithoutNullStreams | null = null;
    let chromeProcess: ChildProcessWithoutNullStreams | null = null;
    let studioApi: SmokeStudioApiServer | null = null;
    const expoOutput: string[] = [];
    const manifest = createAdminSmokeManifest();

    try {
      const projectRoot = await createGeneratedAdminProject(workspaceRoot);
      studioApi = await startSmokeStudioApi({
        manifest,
        projectId: manifest.metadata.slug,
      });
      const rootLayout = await readFile(
        path.join(projectRoot, 'src', 'app', '_layout.tsx'),
        'utf8',
      );
      const generatedPackage = JSON.parse(
        await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };
      const generatedZoraRange = generatedPackage.dependencies?.['@ankhorage/zora'];
      const installedZoraRoot = path.join(projectRoot, 'node_modules', '@ankhorage', 'zora');
      const { resolvedCandidatePath: resolvedZoraRoot, resolvedWorkspacePath } =
        await resolveInstalledPackageProvenance(workspaceRoot, installedZoraRoot);
      const resolvedRepositoryZoraRoot = await realpath(
        path.join(process.cwd(), 'node_modules', '@ankhorage', 'zora'),
      );
      const resolvedZoraPackage = JSON.parse(
        await readFile(path.join(resolvedZoraRoot, 'package.json'), 'utf8'),
      ) as { version?: string };
      const generatedLockfile = await readFile(path.join(workspaceRoot, 'bun.lock'), 'utf8');

      expect(generatedZoraRange).toBe('^2.13.2');
      expect(typeof resolvedZoraPackage.version).toBe('string');
      expect(
        satisfiesCaretSemverRange(resolvedZoraPackage.version ?? '', generatedZoraRange ?? ''),
      ).toBe(true);
      expect(isPathInsideResolved(resolvedWorkspacePath, resolvedZoraRoot)).toBe(true);
      expect(resolvedZoraRoot).not.toBe(resolvedRepositoryZoraRoot);
      expect(
        bunLockfileReferencesPackageVersion(
          generatedLockfile,
          '@ankhorage/zora',
          resolvedZoraPackage.version ?? '',
        ),
      ).toBe(true);
      expect(rootLayout).toContain('function GeneratedZoraThemeConfigSync');
      expect(rootLayout).toContain('lastSyncedThemeConfigSignatureRef');
      expect(rootLayout).not.toContain('}, [setThemeConfig, themeConfig]);');
      expect(rootLayout).toContain('<SmokeNavigationProbe />');

      expoProcess = spawnExpoWeb(projectRoot, studioApi.apiBase);
      collectProcessOutput(expoProcess, expoOutput);
      const appUrl = await waitForExpoWebUrl(expoOutput, HTTP_TIMEOUT_MS);

      const chromePath = resolveChromePath();
      chromeProcess = spawnChrome(chromePath, debugPort);
      const page = await openChromePage(debugPort);
      try {
        await page.blockHotReloadConnections();
        await verifyNestedNutritionSelection(page, appUrl, expoOutput);
        for (const route of [
          '/dashboard',
          '/ankh',
          '/ankh/screens',
          '/ankh/modules',
          '/ankh/theme',
          '/ankh/auth/providers',
          '/ankh/deploy',
        ]) {
          await page.navigateStudio(route);
          await Bun.sleep(ROUTE_SETTLE_MS);
          const bodyText =
            route === '/dashboard'
              ? await waitForBodyText(
                  page,
                  (text) => text.includes('Scrollable Runtime Screen'),
                  HTTP_TIMEOUT_MS,
                )
              : route === '/ankh/deploy'
                ? await waitForBodyText(
                    page,
                    (text) =>
                      text.includes('Deployment administration') &&
                      text.includes('Prepared release desired state') &&
                      text.includes('Monetization synchronization') &&
                      text.includes('1.2.3'),
                    HTTP_TIMEOUT_MS,
                  )
                : await page.readBodyText();
          expect(bodyText).not.toContain('Maximum update depth exceeded');
          if (route === '/dashboard') {
            if (!bodyText.includes('Scrollable Runtime Screen')) {
              throw new Error(
                `Generated dashboard did not load.\nBody:\n${bodyText}\nChrome errors:\n${page.errors.join('\n')}${formatProcessOutput(expoOutput)}`,
              );
            }
            expect(bodyText).toContain('Generated runtime row 16');
            expect(await page.readStudioSmokeState()).toBe('mode=edit;selection=none;changes=5');
            await verifyDesktopSelectionAndUnsupportedGeometry(page, 2, 5);
          }
          if (route === '/ankh/deploy') {
            expect(bodyText).toContain('Store listing locales');
            expect(bodyText).toContain('Monetization desired state');
            expect(bodyText).toContain('Monetization synchronization');
            expect(bodyText).toContain('Release plan and execution');
            expect(bodyText).toContain('smoke-execution-1');
            expect(bodyText).not.toContain('DEP12_SENTINEL_MUST_NOT_CROSS');
          }
          if (route.startsWith('/ankh')) {
            expect(
              await page.evaluate<boolean>(
                `document.querySelector('[aria-label="Preview"], [aria-label="Edit"]') === null`,
              ),
            ).toBe(true);
          }
          expect(page.errors.join('\n')).not.toContain('Maximum update depth exceeded');
          expect(page.errors.join('\n')).not.toContain('Cannot read properties of undefined');
        }

        const deployUrl = new URL('/ankh/deploy', appUrl).toString();
        const directDeployPage = await openChromePage(debugPort);
        try {
          await directDeployPage.blockHotReloadConnections();
          await directDeployPage.navigate(deployUrl);
          await directDeployPage.waitForStudioNavigationReady(HTTP_TIMEOUT_MS, expoOutput);
          expect(
            new URL(await directDeployPage.evaluate<string>('globalThis.location.href')).pathname,
          ).toBe('/ankh/deploy');
          const directDeployBody = await waitForBodyText(
            directDeployPage,
            (text) =>
              text.includes('Deployment administration') &&
              text.includes('Prepared release desired state') &&
              text.includes('Monetization synchronization') &&
              text.includes('smoke-execution-1'),
            HTTP_TIMEOUT_MS,
          );
          expect(directDeployBody).not.toContain('DEP12_SENTINEL_MUST_NOT_CROSS');

          await directDeployPage.reload();
          await directDeployPage.waitForStudioNavigationReady(HTTP_TIMEOUT_MS, expoOutput);
          expect(
            new URL(await directDeployPage.evaluate<string>('globalThis.location.href')).pathname,
          ).toBe('/ankh/deploy');
          const refreshedDeployBody = await waitForBodyText(
            directDeployPage,
            (text) =>
              text.includes('Release plan and execution') &&
              text.includes('Monetization synchronization') &&
              text.includes('smoke-execution-1'),
            HTTP_TIMEOUT_MS,
          );
          expect(refreshedDeployBody).not.toContain('DEP12_SENTINEL_MUST_NOT_CROSS');
          expect(directDeployPage.errors).toEqual([]);
        } finally {
          directDeployPage.close();
        }

        await page.navigateStudio('/ankh/modules', expoOutput);
        const moduleList = await waitForBodyText(
          page,
          (text) => text.includes('Example configurable module'),
          HTTP_TIMEOUT_MS,
        );
        expect(moduleList).toContain('Example enable-only module');

        await page.navigateStudio('/ankh/modules/example-config', expoOutput);
        const configurableModule = await waitForBodyText(
          page,
          (text) => text.includes('Package-owned example config'),
          HTTP_TIMEOUT_MS,
        );
        expect(configurableModule).toContain('Save configuration');

        await page.navigateStudio('/ankh/modules/example-enable-only', expoOutput);
        const enableOnlyModule = await waitForBodyText(
          page,
          (text) => text.includes('No administration contribution'),
          HTTP_TIMEOUT_MS,
        );
        expect(enableOnlyModule).toContain('lifecycle-only');

        await page.navigateStudio('/ankh/modules/unknown-module', expoOutput);
        const unknownModule = await waitForBodyText(
          page,
          (text) => text.includes('Unknown module'),
          HTTP_TIMEOUT_MS,
        );
        expect(unknownModule).toContain('not registered');

        await page.navigateStudio('/ankh/screens/dashboard', expoOutput);
        const detailBeforeRefresh = await waitForBodyText(
          page,
          (text) =>
            text.includes('Stable screen ID') &&
            text.includes('dashboard') &&
            text.includes('Canonical pathname/pattern') &&
            text.includes('/dashboard'),
          HTTP_TIMEOUT_MS,
        );
        expect(detailBeforeRefresh).toContain('Open app screen');
        expect(detailBeforeRefresh).toContain('Hidden');

        const detailUrl = await page.evaluate<string>('globalThis.location.href');
        expect(new URL(detailUrl).pathname).toBe('/ankh/screens/dashboard');
        const directPage = await openChromePage(debugPort);
        try {
          await directPage.navigate(detailUrl);
          expect(
            new URL(await directPage.evaluate<string>('globalThis.location.href')).pathname,
          ).toBe('/ankh/screens/dashboard');
          await directPage.waitForStudioNavigationReady(HTTP_TIMEOUT_MS, expoOutput);
          expect(
            new URL(await directPage.evaluate<string>('globalThis.location.href')).pathname,
          ).toBe('/ankh/screens/dashboard');
          const refreshedDetail = await waitForBodyText(
            directPage,
            (text) =>
              text.includes('Stable screen ID') &&
              text.includes('dashboard') &&
              text.includes('Canonical pathname/pattern') &&
              text.includes('/dashboard'),
            HTTP_TIMEOUT_MS,
          );
          expect(refreshedDetail).toContain('Open app screen');
          expect(refreshedDetail).toContain('Hidden');
          expect(directPage.errors).toEqual([]);
        } finally {
          directPage.close();
        }

        await page.navigateStudio('/ankh/screens/deleted-screen', expoOutput);
        const missingDetail = await waitForBodyText(
          page,
          (text) => text.includes('Screen not found') && text.includes('deleted-screen'),
          HTTP_TIMEOUT_MS,
        );
        expect(missingDetail).toContain('missing or was deleted');
        expect(page.errors).toEqual([]);
      } finally {
        page.close();
      }
    } finally {
      await studioApi?.close();
      stopProcess(chromeProcess);
      stopProcess(expoProcess);
      if (!preservedWorkspaceRoot) {
        await rm(workspaceRoot, { force: true, recursive: true });
      }
    }
  },
  TEST_TIMEOUT_MS,
);

async function verifyNestedNutritionSelection(
  page: ChromePage,
  appUrl: string,
  expoOutput: readonly string[],
): Promise<void> {
  const searchInputNodeId = 'food_drink-nutrition-catalog-scan-products-search-input';
  const catalogScreenId = 'food_drink-nutrition-catalog-scan-catalog';
  const productsScreenRootId = 'food_drink-nutrition-catalog-scan-products-screen';
  const scanScreenId = 'food_drink-nutrition-catalog-scan-scan';
  const scanScreenRootId = 'food_drink-nutrition-catalog-scan-scan-screen';
  const previewNavigationNodeId = 'nutrition-preview-navigation-action';
  const rootScreenState = {
    pathname: '/',
    activeScreenId: catalogScreenId,
    rootNodeId: productsScreenRootId,
  } satisfies StudioScreenStateExpectation;
  const productsScreenState = {
    ...rootScreenState,
    pathname: '/products',
  } satisfies StudioScreenStateExpectation;

  await page.navigate(appUrl);
  await page.waitForStudioNavigationReady(HTTP_TIMEOUT_MS, expoOutput);
  await page.waitForStudioScreenState(rootScreenState, HTTP_TIMEOUT_MS, expoOutput);
  expect(await page.readSelectionRootId()).toBe('studio-stationary-selection-root:edit:none:0');

  await page.navigateStudio('/products', expoOutput, 'replace');
  await page.waitForStudioScreenState(productsScreenState, HTTP_TIMEOUT_MS, expoOutput);
  await waitForBodyText(page, (text) => text.includes('Catalog products'), HTTP_TIMEOUT_MS);
  expect(await page.readSelectionRootId()).toBe('studio-stationary-selection-root:edit:none:0');
  const initialAppBarLabels = ['Administration', 'Preview'];
  const initialAppBarGeometry = await page.readAppBarActionGeometry(initialAppBarLabels);
  expectAppBarActionsHorizontal(initialAppBarGeometry, initialAppBarLabels);

  const interactionBeforeClick = await waitForRuntimeNodeInteractionReady(
    page,
    searchInputNodeId,
    15_000,
    expoOutput,
  );
  expect(interactionBeforeClick.inputExists).toBe(true);
  expect(interactionBeforeClick.inputFocused).toBe(false);
  const searchTarget = interactionBeforeClick.target;
  if (!searchTarget) {
    throw new Error(`Stable Runtime node ${searchInputNodeId} had no target geometry.`);
  }
  await page.mouseClick(
    searchTarget.left + searchTarget.width / 2,
    searchTarget.top + searchTarget.height / 2,
  );
  const selectedRootId = `studio-stationary-selection-root:edit:${searchInputNodeId}:1`;
  await waitForSelectionRootId(page, selectedRootId, 15_000, expoOutput, searchInputNodeId);
  await Bun.sleep(500);
  const settledRootId = await page.readSelectionRootId();
  if (settledRootId !== selectedRootId) {
    throw new Error(
      `Nested selection did not remain settled; received ${settledRootId}; ` +
        `screen state: ${await page.readStudioScreenState()}.` +
        formatProcessOutput(expoOutput),
    );
  }
  expect(await page.readStudioSmokeState()).toBe(
    `mode=edit;selection=${searchInputNodeId};changes=1`,
  );
  expect(await page.readStudioScreenState()).toBe(formatStudioScreenState(productsScreenState));
  const appBarLabels = [
    'Administration',
    'Preview',
    'Properties',
    'Select parent',
    'Clear selection',
  ];
  const selectedAppBarGeometry = await page.readAppBarActionGeometry(appBarLabels);
  expectAppBarActionsHorizontal(selectedAppBarGeometry, appBarLabels);
  expect(
    Math.abs(
      (selectedAppBarGeometry.actions[0]?.rect.top ?? 0) -
        (initialAppBarGeometry.actions[0]?.rect.top ?? 0),
    ),
  ).toBeLessThanOrEqual(2);

  const selectedGeometry = await waitForSelectedGeometry(page, searchInputNodeId, 15_000);
  expectSelectedRectToMatch(selectedGeometry);
  expect(selectedGeometry.pointerEvents).toBe('none');
  expect(selectedGeometry.borderColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.setViewportSize(820, 900);
  const resizedSelectedGeometry = await waitForSelectedGeometry(page, searchInputNodeId, 15_000);
  expectSelectedRectToMatch(resizedSelectedGeometry);
  expectAppBarActionsHorizontal(await page.readAppBarActionGeometry(appBarLabels), appBarLabels);
  await page.setViewportSize(1280, 900);
  expectSelectedRectToMatch(await waitForSelectedGeometry(page, searchInputNodeId, 15_000));

  await page.insertText('edit-mode-must-remain-passive');
  const interactionAfterClick = await page.readRuntimeNodeInteractionSnapshot(searchInputNodeId);
  expect(interactionAfterClick.inputExists).toBe(true);
  expect(interactionAfterClick.inputReadOnly || interactionAfterClick.inputDisabled).toBe(true);
  expect(interactionAfterClick.inputValue).toBe(interactionBeforeClick.inputValue);

  for (const label of ['Properties', 'Select parent', 'Clear selection']) {
    expect(
      await page.evaluate<boolean>(
        `document.querySelector('[aria-label=${JSON.stringify(label)}]') !== null`,
      ),
    ).toBe(true);
  }

  await page.clickAppBarAction('Select parent');
  const parentNodeId = await waitForSelectedNodeAtChangeCount(page, 2, 15_000);
  expect(parentNodeId).not.toBe(searchInputNodeId);
  expect(parentNodeId).not.toBe('none');
  expectSelectedRectToMatch(await waitForSelectedGeometry(page, parentNodeId, 15_000));

  await page.clickAppBarAction('Clear selection');
  await waitForStudioSmokeState(page, 'mode=edit;selection=none;changes=3', 15_000);
  expect(
    await page.evaluate<number>(
      `document.querySelectorAll('[data-testid^="studio-selected-indicator-"]').length`,
    ),
  ).toBe(0);

  const previewNavigationTarget = await page.readRuntimeNodeCenter(previewNavigationNodeId);
  await page.mouseClick(previewNavigationTarget.x, previewNavigationTarget.y);
  await waitForStudioSmokeState(
    page,
    `mode=edit;selection=${previewNavigationNodeId};changes=4`,
    15_000,
  );
  await Bun.sleep(250);
  expect(await page.readStudioScreenState()).toBe(formatStudioScreenState(productsScreenState));

  await page.clickAppBarAction('Preview');
  await waitForStudioSmokeState(
    page,
    `mode=preview;selection=${previewNavigationNodeId};changes=4`,
    15_000,
  );
  expect(await page.readStudioScreenState()).toBe(formatStudioScreenState(productsScreenState));
  expect(await page.readSelectionRootId()).toBe(
    `studio-stationary-selection-root:preview:${previewNavigationNodeId}:2`,
  );
  expectAppBarActionsHorizontal(await page.readAppBarActionGeometry(['Administration', 'Edit']), [
    'Administration',
    'Edit',
  ]);
  for (const label of ['Properties', 'Bindings', 'Insert', 'Delete', 'Select parent']) {
    expect(
      await page.evaluate<boolean>(
        `document.querySelector('[aria-label=${JSON.stringify(label)}]') === null`,
      ),
    ).toBe(true);
  }

  const previewInputTarget = await page.readRuntimeNodeCenter(searchInputNodeId);
  await page.mouseClick(previewInputTarget.x, previewInputTarget.y);
  await page.insertText('preview-enabled');
  const previewInput = await page.readRuntimeNodeInteractionSnapshot(searchInputNodeId);
  expect(previewInput.inputFocused).toBe(true);
  expect(previewInput.inputReadOnly).toBe(false);
  expect(previewInput.inputDisabled).toBe(false);
  expect(previewInput.inputValue).toContain('preview-enabled');

  const previewActionTarget = await page.readRuntimeNodeCenter(previewNavigationNodeId);
  await page.mouseClick(previewActionTarget.x, previewActionTarget.y);
  const scanScreenState = {
    pathname: '/scan',
    activeScreenId: scanScreenId,
    rootNodeId: scanScreenRootId,
  } satisfies StudioScreenStateExpectation;
  await page.waitForStudioScreenState(scanScreenState, HTTP_TIMEOUT_MS, expoOutput);
  expect(await page.readSelectionRootId()).toBe('studio-stationary-selection-root:preview:none:2');
  expectAppBarActionsHorizontal(await page.readAppBarActionGeometry(['Administration', 'Edit']), [
    'Administration',
    'Edit',
  ]);

  await page.clickAppBarAction('Edit');
  expect(await page.readStudioScreenState()).toBe(formatStudioScreenState(scanScreenState));
  expect(await page.readSelectionRootId()).toBe('studio-stationary-selection-root:edit:none:2');
  expectAppBarActionsHorizontal(
    await page.readAppBarActionGeometry(['Administration', 'Preview']),
    ['Administration', 'Preview'],
  );
}

interface BrowserRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface RuntimeNodeInteractionSnapshot {
  readonly activeElement: string | null;
  readonly hitElement: string | null;
  readonly inputDisabled: boolean;
  readonly inputExists: boolean;
  readonly inputFocused: boolean;
  readonly inputReadOnly: boolean;
  readonly inputValue: string | null;
  readonly target: BrowserRect | null;
  readonly wrapper: BrowserRect | null;
  readonly wrapperCount: number;
}

interface UnsupportedGeometrySnapshot {
  readonly indicator: BrowserRect;
  readonly target: BrowserRect;
  readonly neighbor: BrowserRect;
  readonly pointerEvents: string;
}

interface SelectedGeometrySnapshot {
  readonly borderColor: string;
  readonly indicator: BrowserRect;
  readonly pointerEvents: string;
  readonly target: BrowserRect;
}

interface AppBarActionGeometrySnapshot {
  readonly actions: readonly {
    readonly label: string;
    readonly rect: BrowserRect;
  }[];
  readonly clusterHeight: number;
}

interface CapturedLayoutRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface CapturedLayoutSnapshot {
  readonly instances: Readonly<Record<string, number>>;
  readonly rects: Readonly<Record<string, CapturedLayoutRect | null>>;
  readonly scrollContentSizes: Readonly<
    Record<string, { readonly height: number; readonly width: number }>
  >;
}

async function verifyDesktopSelectionAndUnsupportedGeometry(
  page: ChromePage,
  selectionCommitOffset = 0,
  selectionChangeOffset = 0,
): Promise<void> {
  const initialGeometry = await waitForUnsupportedGeometry(page, 15_000);

  expectRectToMatch(initialGeometry.indicator, initialGeometry.target);
  expect(initialGeometry.pointerEvents).toBe('none');
  expect(rectsOverlap(initialGeometry.indicator, initialGeometry.neighbor)).toBe(false);
  expect(
    await page.evaluate<boolean>(
      `document.getElementById('studio-unsupported-indicator-supported-runtime-neighbor') !== null`,
    ),
  ).toBe(false);

  const resized = await page.evaluate<boolean>(`(() => {
    const wrapper = document.getElementById('studio-runtime-node-unsupported-runtime-target');
    const findRenderedElement = (element) => {
      const queue = element ? [...element.children] : [];
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (!(candidate instanceof HTMLElement)) continue;
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return candidate;
        queue.unshift(...candidate.children);
      }
      return null;
    };
    const target = findRenderedElement(wrapper);
    if (!(target instanceof HTMLElement)) return false;
    target.style.width = \`\${target.getBoundingClientRect().width + 40}px\`;
    return true;
  })()`);
  expect(resized).toBe(true);
  await Bun.sleep(250);
  const resizedGeometry = await waitForUnsupportedGeometry(page, 15_000);
  expectRectToMatch(resizedGeometry.indicator, resizedGeometry.target);
  expect(resizedGeometry.target.width - initialGeometry.target.width).toBeGreaterThan(30);

  const scrolled = await page.evaluate<boolean>(`(() => {
    const wrapper = document.getElementById('studio-runtime-node-unsupported-runtime-target');
    const target = wrapper?.firstElementChild;
    if (!(target instanceof HTMLElement)) return false;
    let scrollParent = target.parentElement;
    while (scrollParent) {
      const style = getComputedStyle(scrollParent);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        scrollParent.scrollHeight > scrollParent.clientHeight
      ) {
        scrollParent.scrollTop += 80;
        scrollParent.dispatchEvent(new Event('scroll', { bubbles: true }));
        return true;
      }
      scrollParent = scrollParent.parentElement;
    }
    return false;
  })()`);
  expect(scrolled).toBe(true);
  await Bun.sleep(250);

  const scrolledGeometry = await waitForUnsupportedGeometry(page, 15_000);
  expectRectToMatch(scrolledGeometry.indicator, scrolledGeometry.target);
  expect(Math.abs(scrolledGeometry.target.top - initialGeometry.target.top)).toBeGreaterThan(20);
  expect(rectsOverlap(scrolledGeometry.indicator, scrolledGeometry.neighbor)).toBe(false);

  await page.evaluate(`(() => {
    const wrapper = document.getElementById('studio-runtime-node-unsupported-runtime-target');
    const target = wrapper?.firstElementChild;
    if (!(target instanceof HTMLElement)) return;
    let scrollParent = target.parentElement;
    while (scrollParent) {
      const style = getComputedStyle(scrollParent);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        scrollParent.scrollHeight > scrollParent.clientHeight
      ) {
        scrollParent.scrollTop = 0;
        scrollParent.dispatchEvent(new Event('scroll', { bubbles: true }));
        return;
      }
      scrollParent = scrollParent.parentElement;
    }
  })()`);
  await Bun.sleep(250);

  const rejectedTarget = await page.readRuntimeNodeCenter('unsupported-runtime-target');
  const desktopTarget = await page.readRuntimeNodeCenter('desktop-pointer-target');
  await page.mouseClick(rejectedTarget.x, rejectedTarget.y, 'right');
  await Bun.sleep(250);
  expect(await page.readStudioSmokeState()).toBe(
    `mode=edit;selection=none;changes=${selectionChangeOffset}`,
  );

  await page.mouseClick(desktopTarget.x, desktopTarget.y);
  await waitForStudioSmokeState(
    page,
    `mode=edit;selection=desktop-pointer-target;changes=${selectionChangeOffset + 1}`,
    15_000,
  );
  expect(await page.readSelectionRootId()).toBe(
    `studio-stationary-selection-root:edit:desktop-pointer-target:${selectionCommitOffset + 1}`,
  );

  await page.mouseClick(desktopTarget.x, desktopTarget.y);
  await Bun.sleep(250);
  expect(await page.readStudioSmokeState()).toBe(
    `mode=edit;selection=desktop-pointer-target;changes=${selectionChangeOffset + 1}`,
  );
  expect(await page.readSelectionRootId()).toBe(
    `studio-stationary-selection-root:edit:desktop-pointer-target:${selectionCommitOffset + 1}`,
  );

  await page.mouseClick(rejectedTarget.x, rejectedTarget.y, 'middle');
  await Bun.sleep(250);
  expect(await page.readStudioSmokeState()).toBe(
    `mode=edit;selection=desktop-pointer-target;changes=${selectionChangeOffset + 1}`,
  );

  const secondMouseTarget = await page.readRuntimeNodeCenter('dashboard-runtime-row-0');
  await page.mouseClick(secondMouseTarget.x, secondMouseTarget.y);
  await waitForStudioSmokeState(
    page,
    `mode=edit;selection=dashboard-runtime-row-0;changes=${selectionChangeOffset + 2}`,
    15_000,
  );

  const touchTarget = await page.readRuntimeNodeCenter('dashboard-runtime-row-1');
  await page.evaluate(`(() => {
    globalThis.__studioSmokeInputTrace = [];
    for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click']) {
      document.addEventListener(type, (event) => {
        globalThis.__studioSmokeInputTrace.push({
          type,
          pointerType: event.pointerType ?? null,
          targetId: event.target?.id ?? null,
          targetTestId: event.target?.getAttribute?.('data-testid') ?? null,
        });
      }, { capture: true, once: true });
    }
    return true;
  })()`);
  await page.touchTap(touchTarget.x, touchTarget.y);
  await Bun.sleep(500);
  const touchState = await page.readStudioSmokeState();
  if (
    touchState !==
    `mode=edit;selection=dashboard-runtime-row-1;changes=${selectionChangeOffset + 3}`
  ) {
    throw new Error(
      `Touch selection did not commit; state=${touchState}; trace=${await page.evaluate<string>(
        `JSON.stringify(globalThis.__studioSmokeInputTrace ?? [])`,
      )}`,
    );
  }
  expect(await page.readSelectionRootId()).toBe(
    `studio-stationary-selection-root:edit:dashboard-runtime-row-1:${selectionCommitOffset + 3}`,
  );

  const movedTarget = await page.readRuntimeNodeCenter('dashboard-runtime-row-2');
  await page.mouseDrag(movedTarget.x, movedTarget.y, movedTarget.x + 24, movedTarget.y + 24);
  await Bun.sleep(250);
  expect(await page.readStudioSmokeState()).toBe(
    `mode=edit;selection=dashboard-runtime-row-1;changes=${selectionChangeOffset + 3}`,
  );
  expect(await page.readSelectionRootId()).toBe(
    `studio-stationary-selection-root:edit:dashboard-runtime-row-1:${selectionCommitOffset + 3}`,
  );

  const privateStateBefore = await page.evaluate<string>(
    `document.querySelector('[data-testid="native-row-target-private-state"]')?.textContent ?? ''`,
  );
  const statefulTarget = await page.readRuntimeNodeCenter('native-row-target');
  await page.touchTap(statefulTarget.x, statefulTarget.y);
  await waitForStudioSmokeState(
    page,
    `mode=edit;selection=native-row-target;changes=${selectionChangeOffset + 4}`,
    15_000,
  );
  const privateStateAfterInteraction = await page.evaluate<string>(
    `document.querySelector('[data-testid="native-row-target-private-state"]')?.textContent ?? ''`,
  );
  expect(privateStateAfterInteraction).not.toBe(privateStateBefore);
  expectSelectedRectToMatch(await waitForSelectedGeometry(page, 'native-row-target', 15_000));

  const editLayoutSnapshot = await page.captureSmokeLayout();
  expect(editLayoutSnapshot.rects['native-row-parent']).not.toBeNull();
  expect(editLayoutSnapshot.rects['native-flex-target']).not.toBeNull();
  expect(editLayoutSnapshot.rects['native-align-target']).not.toBeNull();
  expect(editLayoutSnapshot.rects['native-percentage-target']).not.toBeNull();
  expect(editLayoutSnapshot.rects['native-absolute-target']).not.toBeNull();
  expect(editLayoutSnapshot.scrollContentSizes['native-nested-scroll']?.height).toBeGreaterThan(
    220,
  );

  await page.evaluate(`globalThis.__studioSmokeTogglePreview?.()`);
  await waitForStudioSmokeState(
    page,
    `mode=preview;selection=native-row-target;changes=${selectionChangeOffset + 4}`,
    15_000,
  );
  expect(
    await page.evaluate<boolean>(
      `document.getElementById('studio-unsupported-indicator-unsupported-runtime-target') === null`,
    ),
  ).toBe(true);
  expect(
    await page.evaluate<boolean>(
      `document.getElementById('studio-selected-indicator-native-row-target') === null`,
    ),
  ).toBe(true);
  const previewLayoutSnapshot = await page.captureSmokeLayout();
  expectCapturedLayoutsToMatch(previewLayoutSnapshot, editLayoutSnapshot);
  expect(
    await page.evaluate<string>(
      `document.querySelector('[data-testid="native-row-target-private-state"]')?.textContent ?? ''`,
    ),
  ).toBe(privateStateAfterInteraction);

  const previewDesktopTarget = await page.readRuntimeNodeCenter('desktop-pointer-target');
  await page.mouseClick(previewDesktopTarget.x, previewDesktopTarget.y);
  await Bun.sleep(250);
  expect(await page.readStudioSmokeState()).toBe(
    `mode=preview;selection=native-row-target;changes=${selectionChangeOffset + 4}`,
  );
}

function expectCapturedLayoutsToMatch(
  actual: CapturedLayoutSnapshot,
  expected: CapturedLayoutSnapshot,
): void {
  const actualAnchor = actual.rects['native-row-parent'];
  const expectedAnchor = expected.rects['native-row-parent'];
  expect(actualAnchor).not.toBeNull();
  expect(expectedAnchor).not.toBeNull();
  const viewportOffsetX = actualAnchor && expectedAnchor ? actualAnchor.x - expectedAnchor.x : 0;
  const viewportOffsetY = actualAnchor && expectedAnchor ? actualAnchor.y - expectedAnchor.y : 0;

  expect(actual.instances).toEqual(expected.instances);
  expect(actual.scrollContentSizes).toEqual(expected.scrollContentSizes);
  expect(Object.keys(actual.rects).sort()).toEqual(Object.keys(expected.rects).sort());
  for (const [testID, expectedRect] of Object.entries(expected.rects)) {
    const actualRect = actual.rects[testID];
    expect(actualRect == null).toBe(expectedRect == null);
    if (!actualRect || !expectedRect) {
      continue;
    }
    expect(Math.abs(actualRect.x - viewportOffsetX - expectedRect.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(actualRect.y - viewportOffsetY - expectedRect.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(actualRect.width - expectedRect.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(actualRect.height - expectedRect.height)).toBeLessThanOrEqual(2);
  }
}

async function waitForUnsupportedGeometry(
  page: ChromePage,
  timeoutMs: number,
): Promise<UnsupportedGeometrySnapshot> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const snapshot = await page.readUnsupportedGeometry();
    if (snapshot) {
      return snapshot;
    }
    await Bun.sleep(100);
  }

  throw new Error(
    `Timed out waiting for unsupported Runtime indication geometry.\n${await page.readUnsupportedGeometryDiagnostics()}\nChrome errors:\n${page.errors.join('\n')}`,
  );
}

async function waitForSelectedGeometry(
  page: ChromePage,
  nodeId: string,
  timeoutMs: number,
): Promise<SelectedGeometrySnapshot> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const snapshot = await page.readSelectedGeometry(nodeId);
    if (snapshot && selectedRectMatches(snapshot)) {
      return snapshot;
    }
    await Bun.sleep(100);
  }

  throw new Error(
    `Timed out waiting for selected Runtime node geometry for ${nodeId}.\n${await page.readSelectedGeometryDiagnostics(nodeId)}\nChrome errors:\n${page.errors.join('\n')}`,
  );
}

async function waitForStudioSmokeState(
  page: ChromePage,
  expected: string,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if ((await page.readStudioSmokeState()) === expected) {
      return;
    }
    await Bun.sleep(100);
  }

  throw new Error(
    `Timed out waiting for Studio smoke state ${expected}; received ${await page.readStudioSmokeState()}.`,
  );
}

async function waitForSelectedNodeAtChangeCount(
  page: ChromePage,
  changeCount: number,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const state = await page.readStudioSmokeState();
    const match = /^mode=edit;selection=(.+);changes=(\d+)$/.exec(state);
    if (match?.[1] && Number(match[2]) === changeCount) {
      return match[1];
    }
    await Bun.sleep(100);
  }

  throw new Error(
    `Timed out waiting for Studio selection change ${changeCount}; received ${await page.readStudioSmokeState()}.`,
  );
}

function formatStudioScreenState(expected: StudioScreenStateExpectation): string {
  return `pathname=${expected.pathname};activeScreen=${expected.activeScreenId};root=${expected.rootNodeId}`;
}

async function waitForStudioNavigationReady(
  page: StudioNavigationReadinessPage,
  timeoutMs: number,
  expoOutput: readonly string[],
  sleep: (durationMs: number) => Promise<void> = Bun.sleep,
): Promise<void> {
  const maximumAttempts = Math.max(1, Math.ceil(timeoutMs / 100) + 1);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    if (await page.isStudioNavigationReady()) return;
    if (attempt + 1 < maximumAttempts) await sleep(Math.min(100, timeoutMs));
  }

  throw new Error(
    `Timed out waiting for Studio navigation readiness.\n${await page.readStudioNavigationDiagnostics(
      expoOutput,
    )}\nChrome errors:\n${page.errors.join('\n')}`,
  );
}

async function waitForStudioScreenState(
  page: StudioScreenStatePage,
  expected: StudioScreenStateExpectation,
  timeoutMs: number,
  expoOutput: readonly string[],
  sleep: (durationMs: number) => Promise<void> = Bun.sleep,
): Promise<void> {
  const expectedState = formatStudioScreenState(expected);
  const maximumAttempts = Math.max(1, Math.ceil(timeoutMs / 100) + 1);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    if ((await page.readStudioScreenState()) === expectedState) return;
    if (attempt + 1 < maximumAttempts) await sleep(Math.min(100, timeoutMs));
  }

  throw new Error(
    `Timed out waiting for Studio screen state ${expectedState}; received ${await page.readStudioScreenState()}.\n` +
      (await page.readStudioNavigationDiagnostics(expoOutput)),
  );
}

async function invokeStudioNavigation(
  page: StudioNavigationInvocationPage,
  pathname: string,
  expoOutput: readonly string[],
  strategy: 'push' | 'replace' = 'push',
): Promise<void> {
  const didNavigate = await page.evaluate<boolean>(`(() => {
    const navigate = globalThis.__studioSmokeNavigate;
    const ready = globalThis.__studioSmokeNavigationReady;
    if (typeof navigate !== 'function' || ready !== navigate) return false;
    navigate(${JSON.stringify(pathname)}, { replace: ${strategy === 'replace'} });
    return true;
  })()`);
  if (!didNavigate) {
    throw new Error(
      `Studio smoke navigation is unavailable for ${pathname}.\n${await page.readStudioNavigationDiagnostics(
        expoOutput,
      )}`,
    );
  }
}

async function waitForRuntimeNodeInteractionReady(
  page: RuntimeNodeInteractionPage,
  nodeId: string,
  timeoutMs: number,
  expoOutput: readonly string[],
  sleep: (durationMs: number) => Promise<void> = Bun.sleep,
): Promise<RuntimeNodeInteractionSnapshot> {
  const maximumAttempts = Math.max(1, Math.ceil(timeoutMs / 100) + 1);
  let previousSnapshot: RuntimeNodeInteractionSnapshot | null = null;
  let stableSampleCount = 0;
  let latestSnapshot = await page.readRuntimeNodeInteractionSnapshot(nodeId);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    if (attempt > 0) latestSnapshot = await page.readRuntimeNodeInteractionSnapshot(nodeId);
    const isReady =
      latestSnapshot.inputExists &&
      latestSnapshot.target !== null &&
      latestSnapshot.target.width > 0 &&
      latestSnapshot.target.height > 0 &&
      latestSnapshot.hitElement !== null;
    if (isReady && snapshotsHaveMatchingTarget(previousSnapshot, latestSnapshot)) {
      stableSampleCount += 1;
      if (stableSampleCount >= 2) return latestSnapshot;
    } else {
      stableSampleCount = isReady ? 1 : 0;
    }
    previousSnapshot = latestSnapshot;
    if (attempt + 1 < maximumAttempts) await sleep(Math.min(100, timeoutMs));
  }

  throw new Error(
    `Timed out waiting for stable Runtime node ${nodeId}.\nLatest snapshot:\n${JSON.stringify(
      latestSnapshot,
      null,
      2,
    )}\n${await page.readStudioNavigationDiagnostics(expoOutput)}`,
  );
}

function snapshotsHaveMatchingTarget(
  previous: RuntimeNodeInteractionSnapshot | null,
  current: RuntimeNodeInteractionSnapshot,
): boolean {
  if (!previous?.target || !current.target) return false;
  return (
    Math.abs(previous.target.left - current.target.left) <= 0.5 &&
    Math.abs(previous.target.top - current.target.top) <= 0.5 &&
    Math.abs(previous.target.width - current.target.width) <= 0.5 &&
    Math.abs(previous.target.height - current.target.height) <= 0.5 &&
    previous.hitElement === current.hitElement
  );
}

async function waitForSelectionRootId(
  page: ChromePage,
  expected: string,
  timeoutMs: number,
  expoOutput: readonly string[] = [],
  runtimeNodeId?: string,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if ((await page.readSelectionRootId()) === expected) return;
    await Bun.sleep(100);
  }

  const runtimeDiagnostics = runtimeNodeId
    ? `\nRuntime node diagnostics:\n${JSON.stringify(
        await page.readRuntimeNodeInteractionSnapshot(runtimeNodeId),
        null,
        2,
      )}`
    : '';
  throw new Error(
    `Timed out waiting for Studio selection root ${expected}; received ${await page.readSelectionRootId()}; ` +
      `screen state: ${await page.readStudioScreenState()}.` +
      runtimeDiagnostics +
      `\n${await page.readStudioNavigationDiagnostics(expoOutput)}`,
  );
}

function expectRectToMatch(actual: BrowserRect, expected: BrowserRect): void {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(2);
}

function expectSelectedRectToMatch(snapshot: SelectedGeometrySnapshot): void {
  expect(Math.abs(snapshot.indicator.left - (snapshot.target.left - 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(snapshot.indicator.top - (snapshot.target.top - 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(snapshot.indicator.width - (snapshot.target.width + 4))).toBeLessThanOrEqual(2);
  expect(Math.abs(snapshot.indicator.height - (snapshot.target.height + 4))).toBeLessThanOrEqual(2);
}

function selectedRectMatches(snapshot: SelectedGeometrySnapshot): boolean {
  return (
    Math.abs(snapshot.indicator.left - (snapshot.target.left - 2)) <= 2 &&
    Math.abs(snapshot.indicator.top - (snapshot.target.top - 2)) <= 2 &&
    Math.abs(snapshot.indicator.width - (snapshot.target.width + 4)) <= 2 &&
    Math.abs(snapshot.indicator.height - (snapshot.target.height + 4)) <= 2
  );
}

function expectAppBarActionsHorizontal(
  snapshot: AppBarActionGeometrySnapshot,
  labels: readonly string[],
): void {
  expect(snapshot.actions.map((action) => action.label)).toEqual([...labels]);
  const actionHeights = snapshot.actions.map((action) => action.rect.height);
  expect(snapshot.clusterHeight).toBeLessThanOrEqual(Math.max(...actionHeights) + 4);
  for (let index = 1; index < snapshot.actions.length; index += 1) {
    const previous = snapshot.actions[index - 1];
    const current = snapshot.actions[index];
    expect(previous).toBeDefined();
    expect(current).toBeDefined();
    if (previous && current) {
      expect(current.rect.left).toBeGreaterThan(previous.rect.left);
      expect(
        Math.abs(
          current.rect.top +
            current.rect.height / 2 -
            (previous.rect.top + previous.rect.height / 2),
        ),
      ).toBeLessThanOrEqual(2);
    }
  }
}

function rectsOverlap(left: BrowserRect, right: BrowserRect): boolean {
  return (
    Math.min(left.right, right.right) > Math.max(left.left, right.left) &&
    Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
  );
}

async function createGeneratedAdminProject(workspaceRoot: string): Promise<string> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({
      name: '@ankhorage/studio-admin-web-smoke',
      private: true,
      workspaces: ['apps/*'],
    }),
  );

  const projectManager = new ProjectManager(workspaceRoot);
  const moduleManager = new ModuleManager(workspaceRoot);
  const template = getTemplateCatalog()
    .categories.find((candidate) => candidate.id === 'developer_tools')
    ?.templates.at(0);
  if (!template)
    throw new Error('Published templates package returned no developer-tools template.');

  const created = await projectManager.createProject(
    'Generated Admin Web Smoke',
    { category: 'developer_tools', templateId: template.templateId },
    undefined,
    { includeStudio: true },
  );

  await projectManager.persistProjectManifest({
    projectId: created.id,
    manifest: createAdminSmokeManifest(),
  });
  await moduleManager.syncProject({ projectId: created.id, includeStudio: true });
  await writeSmokeRuntimeExtensions(created.path);
  await installSmokeNavigationProbe(created.path);
  await writeSmokeMetroConfig(created.path);
  await installGeneratedProjectDependencies(workspaceRoot, created.path);

  return created.path;
}

async function installGeneratedProjectDependencies(
  workspaceRoot: string,
  projectRoot: string,
): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const generatedPackage = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  if (!generatedPackage.dependencies) {
    throw new Error('Generated smoke project has no dependency map.');
  }
  generatedPackage.dependencies['@ankhorage/studio'] =
    `file:${await stageLocalStudioPackage(workspaceRoot)}`;
  await writeFile(packagePath, `${JSON.stringify(generatedPackage, null, 2)}\n`, 'utf8');

  const install = Bun.spawn(['bun', 'install', '--ignore-scripts'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CI: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    install.exited,
    new Response(install.stdout).text(),
    new Response(install.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`Generated smoke dependency install failed.\n${stdout}\n${stderr}`);
  }
}

async function stageLocalStudioPackage(workspaceRoot: string): Promise<string> {
  const sourcePackage = JSON.parse(
    await readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  const packageRoot = path.join(workspaceRoot, 'packages', 'studio');
  await mkdir(packageRoot, { recursive: true });
  await cp(path.join(process.cwd(), 'dist'), path.join(packageRoot, 'dist'), {
    recursive: true,
  });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: sourcePackage.name,
        version: sourcePackage.version,
        type: sourcePackage.type,
        main: sourcePackage.main,
        exports: sourcePackage.exports,
        dependencies: sourcePackage.dependencies,
        peerDependencies: sourcePackage.peerDependencies,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return packageRoot;
}

async function writeSmokeRuntimeExtensions(projectRoot: string): Promise<void> {
  const generatedRoot = path.join(projectRoot, 'src', 'generated');
  await writeFile(
    path.join(generatedRoot, 'SmokeStudioComponents.tsx'),
    `import { useStudio } from '@ankhorage/studio';
import { useStudioUnsupportedNodeMeasurement } from '@ankhorage/studio/runtime';
import { Box, Text } from '@ankhorage/zora';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text as NativeText,
  View,
  type ViewStyle,
} from 'react-native';

type ViewRef = React.ElementRef<typeof View>;

interface SmokeRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const smokeMeasurements = new Map<string, () => Promise<SmokeRect | null>>();
const smokeInstances = new Map<string, number>();
const smokeScrollContentSizes = new Map<string, { width: number; height: number }>();
let nextSmokeInstanceId = 1;

function useSmokeViewRegistration(testID: string | undefined) {
  const measurement = useStudioUnsupportedNodeMeasurement();
  const viewRef = useRef<ViewRef | null>(null);
  const instanceIdRef = useRef(nextSmokeInstanceId++);

  const setViewRef = useCallback(
    (view: ViewRef | null) => {
      viewRef.current = view;
      measurement.ref(view);
    },
    [measurement.ref],
  );

  useEffect(() => {
    if (!testID) return;
    const measure = () =>
      new Promise<SmokeRect | null>((resolve) => {
        const view = viewRef.current;
        if (!view) {
          resolve(null);
          return;
        }
        view.measureInWindow((x, y, width, height) => {
          resolve({ x, y, width, height });
        });
      });
    smokeMeasurements.set(testID, measure);
    smokeInstances.set(testID, instanceIdRef.current);
    return () => {
      if (smokeMeasurements.get(testID) === measure) {
        smokeMeasurements.delete(testID);
        smokeInstances.delete(testID);
      }
    };
  }, [testID]);

  return {
    instanceId: instanceIdRef.current,
    onLayout: measurement.onLayout,
    ref: setViewRef,
  };
}

async function captureSmokeLayout() {
  const rects = Object.fromEntries(
    await Promise.all(
      [...smokeMeasurements.entries()].map(async ([testID, measure]) => [
        testID,
        await measure(),
      ]),
    ),
  );
  return {
    instances: Object.fromEntries(smokeInstances),
    rects,
    scrollContentSizes: Object.fromEntries(smokeScrollContentSizes),
  };
}

export function SmokeUnsupported({
  label,
  testID,
}: {
  label?: string;
  testID?: string;
}) {
  const registration = useSmokeViewRegistration(testID);
  return (
    <View
      ref={registration.ref}
      onLayout={registration.onLayout}
      testID={testID}
      style={{
        width: 220,
        height: 64,
        padding: 12,
        backgroundColor: '#f3f4f6',
      }}
    >
      <Text>{label ?? 'Unsupported runtime target'}</Text>
    </View>
  );
}

export function SmokeLayoutBox({
  children,
  label,
  stateful = false,
  style,
  testID,
}: {
  children?: React.ReactNode;
  label?: string;
  stateful?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const registration = useSmokeViewRegistration(testID);
  const [privateCount, setPrivateCount] = useState(0);

  return (
    <View
      ref={registration.ref}
      onLayout={registration.onLayout}
      onTouchEnd={stateful ? () => setPrivateCount((count) => count + 1) : undefined}
      testID={testID}
      style={[
        {
          backgroundColor: '#e2e8f0',
          borderColor: '#64748b',
          borderWidth: 1,
          padding: 6,
        },
        style,
      ]}
    >
      {label ? <Text>{label}</Text> : null}
      {stateful ? (
        <Text testID={testID ? \`\${testID}-private-state\` : undefined}>
          {\`instance=\${registration.instanceId};private=\${privateCount}\`}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function SmokeNestedScroll({
  children,
  testID,
}: {
  children?: React.ReactNode;
  testID?: string;
}) {
  const registration = useSmokeViewRegistration(testID);
  return (
    <View
      ref={registration.ref}
      onLayout={registration.onLayout}
      testID={testID}
      style={{ height: 220, width: 320 }}
    >
      <ScrollView
        nestedScrollEnabled
        onContentSizeChange={(width, height) => {
          if (testID) smokeScrollContentSizes.set(testID, { width, height });
        }}
        testID={testID ? \`\${testID}-scroll-view\` : undefined}
        contentContainerStyle={{ gap: 8, padding: 8 }}
        style={{ borderColor: '#94a3b8', borderWidth: 1 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

${SMOKE_NAVIGATION_PROBE_SOURCE}

export function SmokeStudioProbe() {
  const studio = useStudio();
  const pathname = usePathname();
  const previousSelectedNodeIdRef = useRef(studio.selectedNodeId);
  const [selectionChangeCount, setSelectionChangeCount] = useState(0);
  const [layoutSnapshot, setLayoutSnapshot] = useState('not-captured');

  useEffect(() => {
    const smokeGlobal = globalThis as typeof globalThis & {
      __studioSmokeCaptureLayout?: typeof captureSmokeLayout;
      __studioSmokeTogglePreview?: () => void;
    };
    smokeGlobal.__studioSmokeCaptureLayout = captureSmokeLayout;
    smokeGlobal.__studioSmokeTogglePreview = studio.togglePreviewMode;
    return () => {
      delete smokeGlobal.__studioSmokeCaptureLayout;
      delete smokeGlobal.__studioSmokeTogglePreview;
    };
  }, [studio.togglePreviewMode]);

  useEffect(() => {
    if (previousSelectedNodeIdRef.current === studio.selectedNodeId) return;
    previousSelectedNodeIdRef.current = studio.selectedNodeId;
    setSelectionChangeCount((count) => count + 1);
  }, [studio.selectedNodeId]);

  return (
    <Box gap="s" testID="studio-smoke-probe">
      <Text testID="studio-smoke-state">
        {\`mode=\${studio.previewMode ? 'preview' : 'edit'};selection=\${studio.selectedNodeId ?? 'none'};changes=\${selectionChangeCount}\`}
      </Text>
      <Text testID="studio-smoke-screen-state">
        {\`pathname=\${pathname};activeScreen=\${studio.activeScreenId ?? 'none'};root=\${studio.rootNode?.id ?? 'none'}\`}
      </Text>
      <Pressable
        onPress={studio.togglePreviewMode}
        testID="studio-smoke-toggle-preview"
      >
        <Text>Toggle Edit Preview</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void captureSmokeLayout().then((snapshot) => {
            setLayoutSnapshot(JSON.stringify(snapshot));
          });
        }}
        testID="studio-smoke-capture-layout"
      >
        <Text>Capture native layout</Text>
      </Pressable>
      <View
        accessible
        accessibilityLabel={layoutSnapshot}
        testID="studio-smoke-layout-snapshot"
      >
        <NativeText numberOfLines={1}>
          {layoutSnapshot === 'not-captured' ? layoutSnapshot : 'captured'}
        </NativeText>
      </View>
    </Box>
  );
}
`,
    'utf8',
  );
  await writeFile(
    path.join(generatedRoot, 'appExtensionRegistry.ts'),
    `import type { ComponentRegistry } from '@ankhorage/runtime';
import {
  SmokeLayoutBox,
  SmokeNestedScroll,
  SmokeStudioProbe,
  SmokeUnsupported,
} from './SmokeStudioComponents';

export const APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {
  SmokeLayoutBox,
  SmokeNestedScroll,
  SmokeStudioProbe,
  SmokeUnsupported,
};

export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {} as const;
`,
    'utf8',
  );
}

async function writeSmokeMetroConfig(projectRoot: string): Promise<void> {
  const repositoryRoot = process.cwd();
  await writeFile(
    path.join(projectRoot, 'metro.config.js'),
    `const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];
config.watchFolders = [
  path.resolve(__dirname, '../../node_modules'),
  ${JSON.stringify(repositoryRoot)},
];

module.exports = config;
`,
  );
}

async function installSmokeNavigationProbe(projectRoot: string): Promise<void> {
  const rootLayoutPath = path.join(projectRoot, 'src', 'app', '_layout.tsx');
  const rootLayout = await readFile(rootLayoutPath, 'utf8');
  const studioShellMarker = '        <StudioShell\n';
  if (!rootLayout.includes(studioShellMarker)) {
    throw new Error('Generated root layout is missing its Studio shell mount.');
  }

  const withProbeImport =
    `import { SmokeNavigationProbe } from '../generated/SmokeStudioComponents';\n` + rootLayout;
  const withProbeMount = withProbeImport.replace(
    studioShellMarker,
    `        <SmokeNavigationProbe />\n${studioShellMarker}`,
  );
  await writeFile(rootLayoutPath, withProbeMount, 'utf8');
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        const { port } = address;
        server.close(() => resolve(port));
        return;
      }
      server.close(() => reject(new Error('Could not reserve local port.')));
    });
  });
}

function spawnExpoWeb(projectRoot: string, apiBase: string): ChildProcessWithoutNullStreams {
  const expoBin = path.join(process.cwd(), 'apps', 'studio', 'node_modules', '.bin', 'expo');
  return spawn(expoBin, ['start', '--web', '--localhost'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
      EXPO_PUBLIC_API_URL: apiBase,
      NODE_ENV: 'development',
    },
    detached: true,
  });
}

interface SmokeStudioApiServer {
  readonly apiBase: string;
  readonly close: () => Promise<void>;
}

async function startSmokeStudioApi(args: {
  readonly manifest: AppManifest;
  readonly projectId: string;
}): Promise<SmokeStudioApiServer> {
  const { projectId } = args;
  let { manifest } = args;
  const manifestPath = `/api/projects/${encodeURIComponent(projectId)}/manifest`;
  const modulesPath = `/api/projects/${encodeURIComponent(projectId)}/modules`;
  const deployPath = `/api/projects/${encodeURIComponent(projectId)}/deploy`;
  const server = createHttpServer((request, response) => {
    void handleSmokeStudioApiRequest({
      manifest,
      manifestPath,
      modulesPath,
      deployPath,
      request,
      response,
      updateManifest: (nextManifest) => {
        manifest = nextManifest;
      },
    });
  });
  const port = await listenOnLocalhost(server);
  return {
    apiBase: `http://127.0.0.1:${port}/api`,
    close: () => closeHttpServer(server),
  };
}

async function handleSmokeStudioApiRequest(args: {
  readonly manifest: AppManifest;
  readonly manifestPath: string;
  readonly modulesPath: string;
  readonly deployPath: string;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly updateManifest: (manifest: AppManifest) => void;
}): Promise<void> {
  const method = args.request.method ?? 'GET';
  const url = new URL(args.request.url ?? '/', 'http://127.0.0.1');
  writeCorsHeaders(args.response);
  if (method === 'OPTIONS') {
    args.response.statusCode = 204;
    args.response.end();
    return;
  }

  if (method === 'GET' && url.pathname === args.modulesPath) {
    writeJsonResponse(args.response, 200, createSmokeModuleStates());
    return;
  }

  if (method === 'GET' && url.pathname.startsWith(`${args.modulesPath}/`)) {
    const encodedId = url.pathname.slice(args.modulesPath.length + 1);
    const moduleId = decodeURIComponent(encodedId);
    const module = createSmokeModuleStates().find((candidate) => candidate.id === moduleId);
    writeJsonResponse(args.response, module ? 200 : 404, module ?? { error: 'Module not found' });
    return;
  }

  if (method === 'GET' && url.pathname.startsWith(`${args.deployPath}/`)) {
    const ownerState = createSmokeDeployOwnerState(url.pathname.slice(args.deployPath.length + 1));
    if (ownerState !== null) {
      writeJsonResponse(args.response, 200, ownerState);
      return;
    }
  }

  if (url.pathname !== args.manifestPath) {
    writeJsonResponse(args.response, 404, { error: 'Not found' });
    return;
  }

  if (method === 'GET') {
    writeJsonResponse(args.response, 200, args.manifest);
    return;
  }

  if (method === 'PUT') {
    const parsed = await readJsonRequest(args.request);
    if (!isRecord(parsed)) {
      writeJsonResponse(args.response, 400, { error: 'Invalid manifest payload' });
      return;
    }
    args.updateManifest(parsed as unknown as AppManifest);
    writeJsonResponse(args.response, 200, parsed);
    return;
  }

  writeJsonResponse(args.response, 405, { error: 'Method not allowed' });
}

function createSmokeDeployOwnerState(suffix: string): unknown {
  if (suffix === 'config') return { targets: { web: { enabled: true } } };
  if (suffix === 'listing') {
    return {
      revision: 'listing-smoke-r1',
      locales: [{ locale: 'en-US', name: 'Smoke Store' }],
      assetSets: [],
    };
  }
  if (suffix === 'monetization') {
    return { revision: 'monetization-smoke-r1', products: [] };
  }
  if (suffix === 'release') {
    return {
      version: '1.2.3',
      targets: ['web'],
      notes: [{ locale: 'en-US', text: 'Smoke release' }],
      rollout: { web: { mode: 'immediate' } },
      revision: 'release-smoke-r1',
    };
  }
  if (suffix === 'release/history') {
    return [
      {
        schemaVersion: 1,
        executionId: 'smoke-execution-1',
        recordedAt: '2026-08-16T00:00:00.000Z',
        resumable: false,
        desired: {
          version: '1.2.3',
          targets: ['web'],
          notes: [],
          rollout: { web: { mode: 'immediate' } },
          revision: 'release-smoke-r1',
        },
        initialPlan: {
          status: 'changes',
          desiredRevision: 'release-smoke-r1',
          currentRevision: 'current-smoke-r0',
          steps: [],
          diagnostics: [],
        },
        result: {
          status: 'completed',
          plan: {
            status: 'changes',
            desiredRevision: 'release-smoke-r1',
            currentRevision: 'current-smoke-r0',
            steps: [],
            diagnostics: [],
          },
          currentRevision: 'current-smoke-r1',
          executedStepIds: ['web:publish'],
        },
        execution: {
          releaseRevision: 'release-smoke-r1',
          steps: [],
        },
      },
    ];
  }
  return null;
}

function createSmokeModuleStates(): readonly StudioModuleState[] {
  const base = {
    available: true,
    installed: true,
    pendingRemoval: false,
    dependencies: [],
    dependents: [],
  };
  return [
    {
      ...base,
      id: 'example-config',
      name: 'Example configurable module',
      description: 'Browser smoke config contribution',
      config: { value: 'current' },
      admin: {
        kind: 'config-schema',
        title: 'Package-owned example config',
        description: 'Rendered through the generic host.',
        fields: [{ key: 'value', label: 'Value', control: 'text', required: false }],
      },
    },
    {
      ...base,
      id: 'example-enable-only',
      name: 'Example enable-only module',
      description: 'Browser smoke lifecycle-only contribution',
      config: {},
      admin: null,
    },
  ];
}

function listenOnLocalhost(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }
      reject(new Error('Smoke Studio API did not bind a TCP port.'));
    });
  });
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function readJsonRequest(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text.length > 0 ? JSON.parse(text) : null);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Invalid JSON request body.'));
      }
    });
  });
}

function writeJsonResponse(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  writeCorsHeaders(response);
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(value));
}

function writeCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'DELETE, GET, POST, PUT, OPTIONS');
  response.setHeader('Access-Control-Allow-Origin', '*');
}

async function waitForExpoWebUrl(output: readonly string[], timeoutMs: number): Promise<string> {
  const start = Date.now();
  const urlPattern = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/gu;

  while (Date.now() - start < timeoutMs) {
    const match = output.join('').match(urlPattern)?.[0];
    if (match) return match.replace('localhost', '127.0.0.1');
    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for Expo web URL.${formatProcessOutput(output)}`);
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
  getDiagnostics: () => string = () => '',
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}.${getDiagnostics()}`);
}

async function waitForBodyText(
  page: ChromePage,
  predicate: (bodyText: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  let bodyText = '';

  while (Date.now() - start < timeoutMs) {
    bodyText = await page.readBodyText();
    if (predicate(bodyText)) return bodyText;
    await Bun.sleep(500);
  }

  return bodyText;
}

function resolveChromePath(): string {
  const configured = readEnvString('CHROME_PATH');
  if (configured) return configured;
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

function readEnvString(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  const value = env[name];
  return typeof value === 'string' ? value : undefined;
}

function spawnChrome(chromePath: string, debugPort: number): ChildProcessWithoutNullStreams {
  return spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(tmpdir(), `ankh-admin-web-chrome-${debugPort}`)}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { detached: true },
  );
}

async function openChromePage(debugPort: number): Promise<ChromePage> {
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, HTTP_TIMEOUT_MS);
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = (await response.json()) as ChromeJsonTarget;
  const page = new ChromePage(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return page;
}

class ChromePage {
  readonly errors: string[] = [];
  readonly ready: Promise<void>;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  private readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error('Chrome DevTools socket failed to open.'));
    });
    this.socket.onmessage = (event) => this.handleMessage(event.data);
  }

  async navigate(url: string): Promise<void> {
    const loaded = this.waitForLoad();
    await this.send('Page.navigate', { url });
    await loaded;
  }

  async reload(): Promise<void> {
    const loaded = this.waitForLoad();
    await this.send('Page.reload', { ignoreCache: true });
    await loaded;
  }

  async waitForStudioNavigationReady(
    timeoutMs: number,
    expoOutput: readonly string[],
  ): Promise<void> {
    await waitForStudioNavigationReady(this, timeoutMs, expoOutput);
  }

  async waitForStudioScreenState(
    expected: StudioScreenStateExpectation,
    timeoutMs: number,
    expoOutput: readonly string[],
  ): Promise<void> {
    await waitForStudioScreenState(this, expected, timeoutMs, expoOutput);
  }

  async navigateStudio(
    pathname: string,
    expoOutput: readonly string[] = [],
    strategy: 'push' | 'replace' = 'push',
  ): Promise<void> {
    await invokeStudioNavigation(this, pathname, expoOutput, strategy);
  }

  async isStudioNavigationReady(): Promise<boolean> {
    return this.evaluate<boolean>(`(() => {
      const navigate = globalThis.__studioSmokeNavigate;
      return typeof navigate === 'function' && globalThis.__studioSmokeNavigationReady === navigate;
    })()`);
  }

  async readStudioNavigationDiagnostics(expoOutput: readonly string[]): Promise<string> {
    const diagnostics = await this.evaluate<string>(`JSON.stringify({
      url: globalThis.location?.href ?? null,
      pathname: globalThis.location?.pathname ?? null,
      documentReadyState: document.readyState,
      bodyText: (document.body?.innerText ?? '').slice(0, 1_000),
      smokeGlobals: Object.keys(globalThis).filter((key) => key.startsWith('__studioSmoke')).sort(),
      navigationCallbackType: typeof globalThis.__studioSmokeNavigate,
      navigationReady:
        typeof globalThis.__studioSmokeNavigate === 'function' &&
        globalThis.__studioSmokeNavigationReady === globalThis.__studioSmokeNavigate,
      screenState: document.querySelector('[data-testid="studio-smoke-screen-state"]')?.textContent ?? null,
      selectionRoot: document.querySelector('[data-testid="studio-stationary-selection-root"]')?.id ?? null,
    }, null, 2)`);
    return `${diagnostics}\nChrome errors:\n${this.errors.join('\n')}${formatProcessOutput(expoOutput)}`;
  }

  async readBodyText(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'document.body?.innerText ?? ""',
      returnByValue: true,
    });
    if (!isRecord(result)) return '';
    const nestedResult = result.result;
    if (!isRecord(nestedResult)) return '';
    const { value } = nestedResult;
    return typeof value === 'string' ? value : '';
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (!isRecord(result) || !isRecord(result.result)) {
      throw new Error(`Chrome evaluation returned no value for: ${expression}`);
    }
    return ('value' in result.result ? result.result.value : undefined) as T;
  }

  async blockHotReloadConnections(): Promise<void> {
    await this.send('Network.enable');
    await this.send('Network.setBlockedURLs', {
      urls: ['ws://127.0.0.1:*/hot*', 'ws://localhost:*/hot*'],
    });
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await this.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 1,
    });
  }

  async readStudioSmokeState(): Promise<string> {
    return this.evaluate<string>(
      `document.querySelector('[data-testid="studio-smoke-state"]')?.textContent ?? ''`,
    );
  }

  async readStudioScreenState(): Promise<string> {
    return this.evaluate<string>(
      `document.querySelector('[data-testid="studio-smoke-screen-state"]')?.textContent ?? ''`,
    );
  }

  async readSelectionRootId(): Promise<string> {
    return this.evaluate<string>(
      `document.querySelector('[data-testid="studio-stationary-selection-root"]')?.id ?? ''`,
    );
  }

  async readAppBarActionGeometry(labels: readonly string[]): Promise<AppBarActionGeometrySnapshot> {
    return this.evaluate<AppBarActionGeometrySnapshot>(`(() => {
      const labels = ${JSON.stringify(labels)};
      const toRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const actions = [...document.querySelectorAll('[aria-label]')]
        .filter((element) => labels.includes(element.getAttribute('aria-label')))
        .map((element) => ({
          label: element.getAttribute('aria-label'),
          rect: toRect(element),
        }));
      const tops = actions.map((action) => action.rect.top);
      const bottoms = actions.map((action) => action.rect.bottom);
      return {
        actions,
        clusterHeight: actions.length > 0 ? Math.max(...bottoms) - Math.min(...tops) : 0,
      };
    })()`);
  }

  async clickAppBarAction(label: string): Promise<void> {
    const clicked = await this.evaluate<boolean>(`(() => {
      const action = [...document.querySelectorAll('[aria-label]')].find(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)},
      );
      if (!(action instanceof HTMLElement)) return false;
      action.click();
      return true;
    })()`);
    if (!clicked) {
      throw new Error(`Could not find Studio AppBar action ${label}.`);
    }
  }

  async setViewportSize(width: number, height: number): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: true,
    });
  }

  async captureSmokeLayout(): Promise<CapturedLayoutSnapshot> {
    return this.evaluate<CapturedLayoutSnapshot>(
      `globalThis.__studioSmokeCaptureLayout?.() ?? Promise.reject(new Error('Smoke layout capture unavailable'))`,
    );
  }

  async readRuntimeNodeCenter(nodeId: string): Promise<{ readonly x: number; readonly y: number }> {
    const encodedNodeId = encodeURIComponent(nodeId);
    const center = await this.evaluate<{ readonly x: number; readonly y: number } | null>(`(() => {
      const wrapperId = ${JSON.stringify(`studio-runtime-node-${encodedNodeId}`)};
      const wrappers = [...document.querySelectorAll('[id]')].filter(
        (element) => element.id === wrapperId,
      );
      const findRenderedElement = (element) => {
        const queue = element ? [...element.children] : [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (!(candidate instanceof HTMLElement)) continue;
          const rect = candidate.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return candidate;
          queue.unshift(...candidate.children);
        }
        return null;
      };
      const target = wrappers.map(findRenderedElement).find(Boolean) ?? null;
      if (!(target instanceof HTMLElement)) return null;
      let rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        target.scrollIntoView({ block: 'center' });
        rect = target.getBoundingClientRect();
      }
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!center) {
      throw new Error(`Could not resolve browser center for Runtime node ${nodeId}.`);
    }
    return center;
  }

  async readRuntimeNodeInteractionSnapshot(
    nodeId: string,
  ): Promise<RuntimeNodeInteractionSnapshot> {
    const encodedNodeId = encodeURIComponent(nodeId);
    return this.evaluate<RuntimeNodeInteractionSnapshot>(`(() => {
      const wrapperId = ${JSON.stringify(`studio-runtime-node-${encodedNodeId}`)};
      const wrappers = [...document.querySelectorAll('[id]')].filter(
        (element) => element.id === wrapperId,
      );
      const findRenderedElement = (element) => {
        const queue = element ? [...element.children] : [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (!(candidate instanceof HTMLElement)) continue;
          const rect = candidate.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return candidate;
          queue.unshift(...candidate.children);
        }
        return null;
      };
      const rendered = wrappers
        .map((wrapper) => ({ wrapper, target: findRenderedElement(wrapper) }))
        .find(({ target }) => target instanceof HTMLElement);
      const wrapper = rendered?.wrapper ?? null;
      const target = rendered?.target ?? null;
      const input = wrapper?.querySelector('input') ?? null;
      const toRect = (element) => {
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      let targetRect = toRect(target);
      if (
        target instanceof HTMLElement &&
        targetRect &&
        (targetRect.top < 0 || targetRect.bottom > window.innerHeight)
      ) {
        target.scrollIntoView({ block: 'center' });
        targetRect = toRect(target);
      }
      const hit = targetRect
        ? document.elementFromPoint(
            targetRect.left + targetRect.width / 2,
            targetRect.top + targetRect.height / 2,
          )
        : null;
      return {
        activeElement: document.activeElement instanceof HTMLElement
          ? document.activeElement.outerHTML.slice(0, 300)
          : null,
        hitElement: hit instanceof HTMLElement ? hit.outerHTML.slice(0, 300) : null,
        inputDisabled: input instanceof HTMLInputElement && input.disabled,
        inputExists: input instanceof HTMLInputElement,
        inputFocused: input instanceof HTMLInputElement && document.activeElement === input,
        inputReadOnly: input instanceof HTMLInputElement && input.readOnly,
        inputValue: input instanceof HTMLInputElement ? input.value : null,
        target: targetRect,
        wrapper: toRect(wrapper),
        wrapperCount: wrappers.length,
      };
    })()`);
  }

  async readUnsupportedGeometry(): Promise<UnsupportedGeometrySnapshot | null> {
    return this.evaluate<UnsupportedGeometrySnapshot | null>(`(() => {
      const wrapper = document.getElementById(
        'studio-runtime-node-unsupported-runtime-target',
      );
      const findRenderedElement = (element) => {
        const queue = element ? [...element.children] : [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (!(candidate instanceof HTMLElement)) continue;
          const rect = candidate.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return candidate;
          queue.unshift(...candidate.children);
        }
        return null;
      };
      const target = findRenderedElement(wrapper);
      const indicator = document.getElementById(
        'studio-unsupported-indicator-unsupported-runtime-target',
      );
      const neighborWrapper = document.getElementById(
        'studio-runtime-node-supported-runtime-neighbor',
      );
      const neighbor = findRenderedElement(neighborWrapper);
      if (
        !(target instanceof HTMLElement) ||
        !(indicator instanceof HTMLElement) ||
        !(neighbor instanceof HTMLElement)
      ) {
        return null;
      }
      const toRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        target: toRect(target),
        indicator: toRect(indicator),
        neighbor: toRect(neighbor),
        pointerEvents: getComputedStyle(indicator).pointerEvents,
      };
    })()`);
  }

  async readSelectedGeometry(nodeId: string): Promise<SelectedGeometrySnapshot | null> {
    const encodedNodeId = encodeURIComponent(nodeId);
    return this.evaluate<SelectedGeometrySnapshot | null>(`(() => {
      const wrapper = document.getElementById(${JSON.stringify(`studio-runtime-node-${encodedNodeId}`)});
      const indicator = document.getElementById(${JSON.stringify(`studio-selected-indicator-${encodedNodeId}`)});
      const findRenderedElement = (element) => {
        const queue = element ? [...element.children] : [];
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (!(candidate instanceof HTMLElement)) continue;
          const rect = candidate.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return candidate;
          queue.unshift(...candidate.children);
        }
        return null;
      };
      const target = findRenderedElement(wrapper);
      if (!(target instanceof HTMLElement) || !(indicator instanceof HTMLElement)) return null;
      const toRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const style = getComputedStyle(indicator);
      return {
        borderColor: style.borderColor,
        indicator: toRect(indicator),
        pointerEvents: style.pointerEvents,
        target: toRect(target),
      };
    })()`);
  }

  async readSelectedGeometryDiagnostics(nodeId: string): Promise<string> {
    const encodedNodeId = encodeURIComponent(nodeId);
    return this.evaluate<string>(`JSON.stringify({
      state: document.querySelector('[data-testid="studio-smoke-state"]')?.textContent ?? null,
      root: document.querySelector('[data-testid="studio-stationary-selection-root"]')?.id ?? null,
      wrapper: document.getElementById(${JSON.stringify(`studio-runtime-node-${encodedNodeId}`)})?.outerHTML.slice(0, 500) ?? null,
      indicator: document.getElementById(${JSON.stringify(`studio-selected-indicator-${encodedNodeId}`)})?.outerHTML ?? null,
    }, null, 2)`);
  }

  async readUnsupportedGeometryDiagnostics(): Promise<string> {
    return this.evaluate<string>(`JSON.stringify({
      state: document.querySelector('[data-testid="studio-smoke-state"]')?.textContent ?? null,
      root: document.querySelector('[data-testid="studio-stationary-selection-root"]')?.outerHTML.slice(0, 300) ?? null,
      roots: [...document.querySelectorAll('[data-testid="studio-stationary-selection-root"]')].map((element) => element.id),
      wrapper: document.getElementById('studio-runtime-node-unsupported-runtime-target')?.outerHTML.slice(0, 300) ?? null,
      wrapperRoot: document.getElementById('studio-runtime-node-unsupported-runtime-target')?.closest('[data-testid="studio-stationary-selection-root"]')?.id ?? null,
      unsupportedRecorders: [...document.querySelectorAll('[data-testid^="studio-unsupported-recorder-"]')].map((element) => element.getAttribute('data-testid')),
      indicator: document.getElementById('studio-unsupported-indicator-unsupported-runtime-target')?.outerHTML ?? null,
      neighbor: document.getElementById('studio-runtime-node-supported-runtime-neighbor')?.outerHTML.slice(0, 300) ?? null,
    })`);
  }

  async mouseClick(
    x: number,
    y: number,
    button: 'left' | 'middle' | 'right' = 'left',
  ): Promise<void> {
    const buttons = button === 'left' ? 1 : button === 'right' ? 2 : 4;
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button,
      buttons,
      clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button,
      buttons: 0,
      clickCount: 1,
    });
  }

  async insertText(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }

  async mouseDrag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: startX,
      y: startY,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y: startY,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: endX,
      y: endY,
      button: 'left',
      buttons: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: endX,
      y: endY,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
  }

  async touchTap(x: number, y: number): Promise<void> {
    await this.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 1 }],
    });
    await Bun.sleep(100);
    await this.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }

  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const message = JSON.stringify(params ? { id, method, params } : { id, method });
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(message);
    return promise;
  }

  close(): void {
    this.socket.close();
  }

  private waitForLoad(): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10_000);
      const previousMessageHandler = this.socket.onmessage;
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
        const message = parseChromeProtocolMessage(event.data);
        if (message?.method === 'Page.loadEventFired') {
          clearTimeout(timeout);
          this.socket.onmessage = previousMessageHandler;
          resolve();
        }
      };
    });
  }

  private handleMessage(data: unknown): void {
    const message = parseChromeProtocolMessage(data);
    if (!message) return;

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === 'Runtime.exceptionThrown' || message.method === 'Log.entryAdded') {
      this.errors.push(JSON.stringify(message.params));
    }
  }
}

function parseChromeProtocolMessage(data: unknown): ChromeProtocolMessage | null {
  const text =
    typeof data === 'string' ? data : data instanceof Buffer ? data.toString('utf8') : '';
  if (!text) return null;
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) return null;
  return {
    ...(typeof parsed.id === 'number' ? { id: parsed.id } : {}),
    ...(typeof parsed.method === 'string' ? { method: parsed.method } : {}),
    ...('params' in parsed ? { params: parsed.params } : {}),
    ...('result' in parsed ? { result: parsed.result } : {}),
    ...('error' in parsed ? { error: parsed.error } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stopProcess(processToStop: ChildProcessWithoutNullStreams | null): void {
  if (!processToStop?.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}

function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.on('exit', (code, signal) => {
    output.push(`\n[process exited code=${code ?? 'null'} signal=${signal ?? 'null'}]\n`);
  });
}

function formatProcessOutput(output: readonly string[]): string {
  const text = output.join('');
  if (!text) return '';
  return `\nProcess output:\n${text.slice(-8_000)}`;
}
