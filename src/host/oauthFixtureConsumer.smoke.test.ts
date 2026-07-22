import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
      (projectId) => moduleManager.generateModuleRegistry(projectId),
      { includeStudio: false },
    );
    expect(created.id).toBe(PROJECT_ID);

    const manifest = createOAuthFixtureManifest({
      category: 'developer_tools',
      fixture: 'google-apple',
      overrides: {
        metadata: {
          name: PROJECT_NAME,
          slug: PROJECT_ID,
        },
      },
    });
    const oauth = manifest.infra.auth?.oauth;
    if (!oauth) {
      throw new Error('Combined OAuth fixture did not configure OAuth.');
    }
    for (const provider of oauth.providers) {
      provider.credentialsRef = `${SECRET_SENTINEL}/${provider.id}`;
    }

    await projectManager.saveStudioManifest({ projectId: created.id, manifest });
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
    expect(packageJson.dependencies?.['@ankhorage/contracts']).toBe('^4.0.0');
    expect(packageJson.dependencies?.['@ankhorage/supabase-auth']).toBe('^1.0.0');
    expect(packageJson.dependencies?.['expo-secure-store']).toBe('~15.0.8');
    expect(packageJson.dependencies?.['expo-web-browser']).toBe('~15.0.11');

    const appConfig = await readProjectFile(created.path, 'app.config.ts');
    expect(appConfig).toContain("scheme: 'ankh-oauthfixtureconsumer'");
    expect(appConfig).toContain("package: 'com.ankh.oauthfixtureconsumer'");
    expect(appConfig).toContain("bundleIdentifier: 'com.ankh.oauthfixtureconsumer'");

    const adapter = await readProjectFile(created.path, 'src/auth/adapter.ts');
    expect(adapter).toContain('const generatedOAuthProviders = ["google","apple"] as const;');
    expect(adapter).toContain('createSupabaseAuthAdapter({');
    expect(adapter).toContain('oauthProviders: generatedOAuthProviders');

    const oauthRuntime = await readProjectFile(created.path, 'src/auth/oauth.ts');
    expect(oauthRuntime).toContain(`const OAUTH_CALLBACK_ROUTE = '${OAUTH_CALLBACK_ROUTE}';`);
    expect(oauthRuntime).toContain('"id":"google"');
    expect(oauthRuntime).toContain('"id":"apple"');
    expect(oauthRuntime).toContain("Platform.OS === 'web'");
    expect(oauthRuntime).toContain('new URL(`/${callbackPath}`');
    expect(oauthRuntime).toContain('Linking.createURL(callbackPath)');
    expect(oauthRuntime).toContain('WebBrowser.openAuthSessionAsync(');
    expect(oauthRuntime).toContain(
      "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';",
    );

    const callback = await readProjectFile(created.path, callbackPath);
    expect(callback).toContain('WebBrowser.maybeCompleteAuthSession()');
    expect(callback).toContain('const callbackUrl = Linking.useURL();');
    expect(callback).toContain('callbackUrl ?? (await Linking.getInitialURL())');
    expect(callback).toContain('const handledRef = useRef(false);');
    expect(callback).toContain('const outcome = await completeOAuthCallback(deliveredUrl);');
    expect(callback).not.toContain('POST_SIGN_IN_ROUTE');
    expect(callback).not.toContain('router.replace(POST_SIGN_IN_ROUTE);');

    const signInScreen = await readProjectFile(created.path, 'src/app/sign-in.tsx');
    expect(signInScreen).toContain('OAuthProviderList');
    expect(signInScreen).toContain('generatedOAuthProviderItems');
    expect(signInScreen).toContain('startOAuthAuthorization(providerId)');
    expect(signInScreen).not.toContain('POST_SIGN_IN_ROUTE');
    expect(signInScreen).toContain('or continue with password');

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
