import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { createOAuthFixtureManifest, OAUTH_CALLBACK_ROUTE } from '@ankhorage/templates';
import { expect, test } from 'bun:test';

import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';
import { getTemplateCatalog } from './templateRegistry';

const SECRET_SENTINEL = 'sentinel-phase3-consumer-secret-do-not-leak';
const PROJECT_NAME = 'OAuth Fixture Consumer';
const PROJECT_ID = 'oauth-fixture-consumer';

async function collectRelativeFiles(root: string, current = ''): Promise<string[]> {
  const absolute = path.join(root, current);
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = current ? path.join(current, entry.name) : entry.name;
      if (entry.isDirectory()) {
        return collectRelativeFiles(root, relative);
      }
      return [relative.replaceAll(path.sep, '/')];
    }),
  );
  return nested.flat().sort();
}

async function readProjectFile(projectRoot: string, relativePath: string): Promise<string> {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('generates the released Google and Apple OAuth fixture through the real host pipeline', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankhorage-oauth-consumer-'));

  try {
    await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({
        name: '@ankhorage/studio-oauth-consumer-smoke',
        private: true,
        workspaces: ['apps/*'],
      }),
    );

    const projectManager = new ProjectManager(workspaceRoot);
    const moduleManager = new ModuleManager(workspaceRoot);
    const template = getTemplateCatalog()
      .categories.find((candidate) => candidate.id === 'developer_tools')
      ?.templates.at(0);
    if (!template) {
      throw new Error('Published templates package returned no developer-tools template.');
    }

    const created = await projectManager.createProject(
      PROJECT_NAME,
      { category: 'developer_tools', templateId: template.templateId },
      undefined,
      { includeStudio: false },
    );
    expect(created.id).toBe(PROJECT_ID);

    const createdManifest = await projectManager.getProjectManifest(created.id);
    const fixtureManifest = createOAuthFixtureManifest({
      category: 'developer_tools',
      fixture: 'google-apple',
      overrides: {
        metadata: {
          name: PROJECT_NAME,
          slug: PROJECT_ID,
        },
      },
    });
    const manifest = { ...fixtureManifest, deploy: createdManifest.deploy };
    const oauth = manifest.infra.auth?.oauth;
    if (!oauth) {
      throw new Error('Combined OAuth fixture did not configure OAuth.');
    }
    for (const provider of oauth.providers) {
      provider.credentialsRef = `${SECRET_SENTINEL}/${provider.id}`;
    }

    await projectManager.persistProjectManifest({ projectId: created.id, manifest });
    await moduleManager.syncProject({ projectId: created.id, includeStudio: false });

    const persistedManifest = await projectManager.getProjectManifest(created.id);
    expect(persistedManifest.infra.auth?.oauth?.callbackRoute).toBe(OAUTH_CALLBACK_ROUTE);
    expect(
      persistedManifest.infra.auth?.oauth?.providers.map((provider) => ({
        id: provider.id,
        credentialsRef: provider.credentialsRef,
      })),
    ).toEqual([
      { id: 'google', credentialsRef: `${SECRET_SENTINEL}/google` },
      { id: 'apple', credentialsRef: `${SECRET_SENTINEL}/apple` },
    ]);

    const generatedFiles = await collectRelativeFiles(created.path);
    const callbackPath = `src/app/${OAUTH_CALLBACK_ROUTE}.tsx`;
    expect(generatedFiles.filter((file) => file === callbackPath)).toEqual([callbackPath]);

    const packageJson = JSON.parse(await readProjectFile(created.path, 'package.json')) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.['@ankhorage/contracts']).toBe('^8.0.0');
    expect(packageJson.dependencies?.['@ankhorage/supabase-auth']).toBe('^1.2.5');
    expect(packageJson.dependencies?.[EXPO_PLATFORM.packages.crypto.name]).toBe(
      EXPO_PLATFORM.packages.crypto.version,
    );
    expect(packageJson.dependencies?.[EXPO_PLATFORM.packages.secureStore.name]).toBe(
      EXPO_PLATFORM.packages.secureStore.version,
    );
    expect(packageJson.dependencies?.[EXPO_PLATFORM.packages.webBrowser.name]).toBe(
      EXPO_PLATFORM.packages.webBrowser.version,
    );

    const appConfig = await readProjectFile(created.path, 'app.config.ts');
    expect(appConfig).toContain("scheme: 'ankh-oauthfixtureconsumer'");
    expect(appConfig).toContain("package: 'com.ankh.oauthfixtureconsumer'");
    expect(appConfig).toContain("bundleIdentifier: 'com.ankh.oauthfixtureconsumer'");

    const adapter = await readProjectFile(created.path, 'src/auth/adapter.ts');
    expect(adapter).toContain("import { getRandomBytes } from 'expo-crypto';");
    expect(adapter).toContain("const generatedOAuthProviders = ['google', 'apple'] as const;");
    expect(adapter).toContain('createSupabaseAuthAdapter({');
    expect(adapter).toContain('oauthProviders: generatedOAuthProviders');
    expect(adapter).toContain('oauthRandomBytes: getRandomBytes');

    const oauthRuntime = await readProjectFile(created.path, 'src/auth/oauth.ts');
    const oauthCompletion = await readProjectFile(created.path, 'src/auth/oauth-completion.ts');
    const oauthState = await readProjectFile(created.path, 'src/auth/oauth-state.ts');
    expect(oauthCompletion).toContain(`const OAUTH_CALLBACK_ROUTE = '${OAUTH_CALLBACK_ROUTE}';`);
    expect(oauthRuntime).toContain("id: 'google'");
    expect(oauthRuntime).toContain("id: 'apple'");
    expect(oauthRuntime).toContain("Platform.OS === 'web'");
    expect(oauthCompletion).toContain('new URL(`/${callbackPath}`');
    expect(oauthCompletion).toContain("android: 'ankh-oauthfixtureconsumer'");
    expect(oauthCompletion).toContain("ios: 'ankh-oauthfixtureconsumer'");
    expect(oauthCompletion).toContain('Linking.createURL(callbackPath, { scheme: nativeScheme })');
    expect(oauthRuntime).toContain('location.assign(args.authorizationUrl);');
    expect(oauthRuntime).toContain('WebBrowser.openAuthSessionAsync(');
    expect(oauthRuntime).not.toContain('window.closed');
    expect(oauthState).toContain(
      "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';",
    );
    expect(oauthState).not.toContain('LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY');
    expect(oauthState).not.toContain('ankh.auth.oauth.transport.v1');
    expect(oauthState).not.toContain('ankh.auth.oauth.transport.v2');
    expect(oauthState).toContain('interface StoredTransportAttempt {\n  attemptId: string;\n}');
    expect(oauthCompletion).toContain('export function resolveOAuthCallbackUrl(');
    expect(oauthCompletion).toContain('callbackUrl.searchParams.append(name, value);');
    expect(oauthState).not.toContain('provider: AuthOAuthProviderId;');

    const callback = await readProjectFile(created.path, callbackPath);
    expect(callback).not.toContain("from 'expo-web-browser'");
    expect(callback).not.toContain("from 'expo-linking'");
    expect(callback).not.toContain('WebBrowser.maybeCompleteAuthSession()');
    expect(callback).not.toContain('window.closed');
    expect(callback).not.toContain('Linking.useURL()');
    expect(callback).not.toContain('Linking.getInitialURL()');
    expect(callback).toContain('useLocalSearchParams<Record<string, string | string[]>>()');
    expect(callback).toContain('return resolveOAuthCallbackUrl(params);');
    expect(callback).toContain(
      'const callbackUrl = useMemo(() => resolveCallbackUrl(callbackParams), [callbackParams]);',
    );
    expect(oauthCompletion).toContain(
      'let activeCallbackCompletion: ActiveCallbackCompletion | null = null;',
    );
    expect(oauthCompletion).toContain('promise: completeOAuthCallbackAsync(callbackUrl)');
    expect(callback).not.toContain('ActiveCallbackCompletion');
    expect(callback).toContain('const handledOutcomeRef = useRef(false);');
    expect(callback).toContain('const outcome = await completeOAuthCallback(callbackUrl);');
    expect(callback).toContain('router.replace(POST_SIGN_IN_ROUTE);');

    const signInScreen = await readProjectFile(created.path, 'src/app/(auth)/sign-in.tsx');
    const authScreenRuntime = await readProjectFile(created.path, 'src/screens/auth-screen.tsx');
    expect(signInScreen).toContain('GeneratedAuthScreen');
    expect(authScreenRuntime).toContain('OAuthProviderList');
    expect(authScreenRuntime).toContain('generatedOAuthProviderItems');
    expect(authScreenRuntime).toContain('startOAuthAuthorization(providerId)');
    expect(authScreenRuntime).toContain('or continue with password');

    const session = await readProjectFile(created.path, 'src/auth/session.ts');
    expect(session).toContain("import * as SecureStore from 'expo-secure-store';");
    expect(session).toContain("Platform.OS === 'ios' || Platform.OS === 'android'");
    expect(session).toContain('SecureStore.getItemAsync(key)');
    expect(session).toContain('SecureStore.setItemAsync(key, value)');
    expect(session).toContain('SecureStore.deleteItemAsync(key)');
    expect(session).toContain("Reflect.get(globalThis, 'localStorage')");
    expect(session).not.toContain('globalThis.localStorage');

    const publicRuntimePaths = generatedFiles.filter(
      (file) => file.startsWith('src/') || file === 'app.config.ts' || file === 'package.json',
    );
    const publicRuntimeOutput = (
      await Promise.all(publicRuntimePaths.map((file) => readProjectFile(created.path, file)))
    ).join('\n');
    expect(publicRuntimeOutput).not.toContain(SECRET_SENTINEL);
    expect(publicRuntimeOutput).not.toContain('credentialsRef');
    expect(publicRuntimeOutput).not.toContain('clientSecret');
    expect(publicRuntimeOutput).not.toContain('privateKey');
    expect(publicRuntimeOutput).not.toContain('serviceRoleKey');
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}, 45_000);
