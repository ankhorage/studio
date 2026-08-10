import type { AppManifest } from '@ankhorage/contracts';
import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';

import { ProjectManager } from './orchestrator/projectManager';
import { getProjectPath } from './orchestrator/projectPaths';
import { ProjectSecretService } from './secrets/projectSecretService';

const ROOT = path.join(process.cwd(), '.tmp-oauth-fixture-consumer');
const PROJECT_NAME = 'OAuth Fixture Consumer';
const PROJECT_ID = 'oauth-fixture-consumer';
const SECRET_SENTINEL = 'vault://local/oauth-fixture-consumer/oauth';
const OAUTH_CALLBACK_ROUTE = 'oauth-callback';

const SECRET_STORE = new Map<string, Record<string, string>>();

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
  SECRET_STORE.clear();
});

afterEach(async () => {
  mock.restore();
  await fs.rm(ROOT, { recursive: true, force: true });
});

test('generates the released Google and Apple OAuth fixture through the real host pipeline', async () => {
  const manager = new ProjectManager(ROOT);
  const created = await manager.createProject(PROJECT_NAME, {
    category: 'food_drink',
    templateId: 'nutrition-catalog-scan',
  });

  const initial = await manager.getProjectManifest(created.id);
  const auth = initial.infra.auth;
  if (!auth) throw new Error('Expected auth config.');

  const configured: AppManifest = {
    ...initial,
    infra: {
      ...initial.infra,
      auth: {
        ...auth,
        oauth: {
          callbackRoute: OAUTH_CALLBACK_ROUTE,
          providers: [
            {
              id: 'google',
              enabled: true,
              credentialsRef: `${SECRET_SENTINEL}/google`,
            },
            {
              id: 'apple',
              enabled: true,
              credentialsRef: `${SECRET_SENTINEL}/apple`,
            },
          ],
        },
      },
    },
  };

  await manager.saveProjectManifest({
    projectId: created.id,
    manifest: configured,
    mutations: [],
  });

  const persistedManifest = await manager.getProjectManifest(created.id);
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
  const callbackPath = `src/app/(auth)/${OAUTH_CALLBACK_ROUTE}.tsx`;
  expect(generatedFiles.filter((file) => file === callbackPath)).toEqual([callbackPath]);

  const packageJson = JSON.parse(await readProjectFile(created.path, 'package.json')) as {
    dependencies?: Record<string, string>;
  };
  expect(packageJson.dependencies?.['@ankhorage/contracts']).toBe('^4.0.2');
  expect(packageJson.dependencies?.['@ankhorage/supabase-auth']).toBe('^1.1.2');
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
  expect(oauthRuntime).toContain("Reflect.get(location, 'assign')");
  expect(oauthRuntime).toContain('Reflect.apply(assign, location, [args.authorizationUrl]);');
  expect(oauthRuntime).toContain('WebBrowser.openAuthSessionAsync(');
  expect(oauthRuntime).not.toContain('window.closed');
  expect(oauthRuntime).toContain(
    "const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';",
  );
  expect(oauthRuntime).toContain(
    "const OAUTH_TRANSPORT_MARKER_KEY = 'ankh.auth.oauth.transport.v2.marker';",
  );
  expect(oauthRuntime).not.toContain('localStorage');

  const secretService = new ProjectSecretService(ROOT, {
    getSecretStore: async () => ({
      isAvailable: async () => true,
      getSecret: async (ref) => SECRET_STORE.get(ref) ?? null,
      setSecret: async (ref, value) => {
        SECRET_STORE.set(ref, value);
      },
      deleteSecret: async (ref) => {
        SECRET_STORE.delete(ref);
      },
      listSecretRefs: async () => [...SECRET_STORE.keys()],
    }),
  });
  expect(await secretService.getProjectSecretUsage(PROJECT_ID, `${SECRET_SENTINEL}/google`)).toEqual(
    expect.objectContaining({ count: 1 }),
  );
});

async function readProjectFile(projectPath: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(projectPath, relativePath), 'utf8');
}

async function collectRelativeFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  await walk(root, '');
  return files.sort();

  async function walk(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else {
        files.push(relativePath.split(path.sep).join('/'));
      }
    }
  }
}
