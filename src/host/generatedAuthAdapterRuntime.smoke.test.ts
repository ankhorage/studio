import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';
import { getTemplateCatalog } from './templateRegistry';

const execFile = promisify(execFileCallback);
const PROJECT_NAME = 'Generated Auth Runtime';
const PROJECT_ID = 'generated-auth-runtime';
const AUTH_SMOKE_SCRIPT = 'auth-runtime-smoke.ts';
const SUPABASE_URL = 'http://127.0.0.1:55444';
const UPDATED_SUPABASE_URL = 'http://127.0.0.1:55445';
const SUPABASE_ANON_KEY = 'runtime-smoke-anon-key';
const requireFromAggregateNodeModules = createRequire(
  path.join(process.cwd(), 'node_modules/.bun/node_modules/expo/package.json'),
);

interface RuntimeSmokeRequest {
  readonly url: string;
  readonly method: string | null;
  readonly apikey: string | null;
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly body: unknown;
}

interface RuntimeSmokeResult {
  readonly signIn?: unknown;
  readonly signUp?: unknown;
  readonly requests: RuntimeSmokeRequest[];
}

interface BabelTransformResult {
  readonly code?: string | null;
}

interface BabelCore {
  transformAsync(
    source: string,
    options: Readonly<Record<string, unknown>>,
  ): Promise<BabelTransformResult | null>;
}

function requireAggregateModule(specifier: string): unknown {
  return requireFromAggregateNodeModules(specifier) as unknown;
}

function isBabelCore(value: unknown): value is BabelCore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'transformAsync' in value &&
    typeof value.transformAsync === 'function'
  );
}

function readEnvString(name: string): string | undefined {
  const env = process.env as unknown as Record<string, string | undefined>;
  const value = env[name];
  return typeof value === 'string' ? value : undefined;
}

function createRuntimeSmokeManifest(): AppManifest {
  return {
    metadata: {
      name: PROJECT_NAME,
      slug: PROJECT_ID,
      version: '1.0.0',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      plugins: [],
      auth: {
        scope: 'global',
        provider: 'supabase',
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute: 'dashboard',
          unauthorizedRoute: 'sign-in',
        },
        signIn: { identifiers: ['email'] },
        signUp: {
          requiredFields: ['email', 'password'],
          signUpPolicy: 'autoSignIn',
        },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'dashboard' }],
    },
    screens: {
      dashboard: {
        id: 'dashboard',
        name: 'Dashboard',
        root: { id: 'dashboard-root', type: 'Page' },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

async function createGeneratedProject(): Promise<{ workspaceRoot: string; projectRoot: string }> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankhorage-auth-runtime-'));

  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({
      name: '@ankhorage/studio-auth-runtime-smoke',
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

  await projectManager.saveStudioManifest({
    projectId: created.id,
    manifest: createRuntimeSmokeManifest(),
  });
  await moduleManager.syncProject({ projectId: created.id, includeStudio: false });
  await writeRuntimeSmokeScript(created.path);
  await writeRuntimeSmokeNodeModules(workspaceRoot);

  return { workspaceRoot, projectRoot: created.path };
}

async function writeRuntimeSmokeNodeModules(workspaceRoot: string): Promise<void> {
  const nodeModulesRoot = path.join(workspaceRoot, 'node_modules');
  const ankhorageRoot = path.join(nodeModulesRoot, '@ankhorage');

  await mkdir(ankhorageRoot, { recursive: true });
  await symlink(
    await realpath(path.join(process.cwd(), 'node_modules/@ankhorage/contracts')),
    path.join(ankhorageRoot, 'contracts'),
    'dir',
  );
  await symlink(
    await realpath(path.join(process.cwd(), 'node_modules/@ankhorage/supabase-auth')),
    path.join(ankhorageRoot, 'supabase-auth'),
    'dir',
  );
  await writeStubPackage(nodeModulesRoot, 'expo-secure-store', {
    'index.js': `const store = new Map();
export async function getItemAsync(key) {
  return store.get(key) ?? null;
}
export async function setItemAsync(key, value) {
  store.set(key, value);
}
export async function deleteItemAsync(key) {
  store.delete(key);
}
`,
  });
  await writeStubPackage(nodeModulesRoot, 'react-native', {
    'index.js': `export const Platform = { OS: 'web' };
`,
  });
}

async function writeStubPackage(
  nodeModulesRoot: string,
  name: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const packageRoot = path.join(nodeModulesRoot, name);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name, version: '0.0.0-smoke', type: 'module', main: './index.js' }),
  );

  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(packageRoot, fileName), content),
    ),
  );
}

async function writeRuntimeSmokeScript(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, AUTH_SMOKE_SCRIPT),
    `type RecordedRequest = {
  url: string;
  method: string | null;
  apikey: string | null;
  authorization: string | null;
  contentType: string | null;
  body: unknown;
};

const requests: RecordedRequest[] = [];
const fetchMode = process.env.AUTH_SMOKE_FETCH_MODE ?? 'success';
const action = process.env.AUTH_SMOKE_ACTION ?? 'signIn';

globalThis.fetch = async (url, init) => {
  const headers = new Headers(init?.headers);
  const rawBody = typeof init?.body === 'string' ? init.body : '';
  requests.push({
    url: String(url),
    method: init?.method ?? null,
    apikey: headers.get('apikey'),
    authorization: headers.get('authorization'),
    contentType: headers.get('content-type'),
    body: rawBody.length > 0 ? JSON.parse(rawBody) : null,
  });

  if (fetchMode === 'throw') {
    throw new TypeError('connect ECONNREFUSED runtime smoke');
  }

  if (fetchMode === 'http-error') {
    return new Response(JSON.stringify({ message: 'Email rate limit exceeded' }), {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      access_token: 'runtime-smoke-access-token',
      refresh_token: 'runtime-smoke-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'runtime-smoke-user', email: 'runtime@example.test' },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};

const { authAdapter } = await import('./src/auth/adapter');
const credentials = {
  identifier: { kind: 'email' as const, value: 'runtime@example.test' },
  password: 'correct horse battery staple',
};
const result: { signIn?: unknown; signUp?: unknown; requests: RecordedRequest[] } = {
  requests,
};

if (action === 'both' || action === 'signIn') {
  result.signIn = await authAdapter.signIn(credentials);
}

if (action === 'both' || action === 'signUp') {
  result.signUp = await authAdapter.signUp({
    ...credentials,
    profile: { displayName: 'Runtime Smoke' },
  });
}

console.log(JSON.stringify(result));
`,
  );
}

async function runRuntimeSmoke(
  projectRoot: string,
  options: {
    readonly action?: 'signIn' | 'signUp' | 'both';
    readonly fetchMode?: 'success' | 'throw' | 'http-error';
    readonly supabaseUrl?: string;
    readonly supabaseAnonKey?: string;
  },
): Promise<RuntimeSmokeResult> {
  const { stdout } = await execFile('bun', [AUTH_SMOKE_SCRIPT], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AUTH_SMOKE_ACTION: options.action ?? 'signIn',
      AUTH_SMOKE_FETCH_MODE: options.fetchMode ?? 'success',
      EXPO_PUBLIC_SUPABASE_URL: options.supabaseUrl ?? '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: options.supabaseAnonKey ?? '',
    },
  });

  return JSON.parse(stdout.trim()) as RuntimeSmokeResult;
}

function expectAuthError(
  result: unknown,
  expected: {
    readonly code: string;
    readonly message: string;
  },
): void {
  expect(result).toMatchObject({
    ok: false,
    error: expected,
  });
}

test('generated Supabase Auth adapter executes against Infra-provided public env only', async () => {
  const { workspaceRoot, projectRoot } = await createGeneratedProject();

  try {
    const adapterSourceBefore = await readFile(
      path.join(projectRoot, 'src/auth/adapter.ts'),
      'utf8',
    );

    for (const env of [
      { supabaseUrl: '', supabaseAnonKey: SUPABASE_ANON_KEY },
      { supabaseUrl: SUPABASE_URL, supabaseAnonKey: '' },
    ]) {
      const missing = await runRuntimeSmoke(projectRoot, {
        action: 'both',
        fetchMode: 'success',
        ...env,
      });
      expect(missing.requests).toEqual([]);
      expectAuthError(missing.signIn, {
        code: 'missing-supabase-auth-env',
        message:
          'Supabase Auth environment is missing. Run generated Infra Up successfully, verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app .env.local, then restart Expo.',
      });
      expectAuthError(missing.signUp, {
        code: 'missing-supabase-auth-env',
        message:
          'Supabase Auth environment is missing. Run generated Infra Up successfully, verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app .env.local, then restart Expo.',
      });
    }

    const configured = await runRuntimeSmoke(projectRoot, {
      action: 'both',
      fetchMode: 'success',
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
    expect(configured.signIn).toMatchObject({ ok: true });
    expect(configured.signUp).toMatchObject({ ok: true });
    expect(configured.requests).toMatchObject([
      {
        url: `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        method: 'POST',
        apikey: SUPABASE_ANON_KEY,
        contentType: 'application/json',
        body: {
          email: 'runtime@example.test',
          password: 'correct horse battery staple',
        },
      },
      {
        url: `${SUPABASE_URL}/auth/v1/signup`,
        method: 'POST',
        apikey: SUPABASE_ANON_KEY,
        contentType: 'application/json',
        body: {
          email: 'runtime@example.test',
          password: 'correct horse battery staple',
          data: { displayName: 'Runtime Smoke' },
        },
      },
    ]);

    const unreachable = await runRuntimeSmoke(projectRoot, {
      action: 'signIn',
      fetchMode: 'throw',
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
    expect(unreachable.requests).toHaveLength(1);
    expectAuthError(unreachable.signIn, {
      code: 'network_error',
      message: 'Unable to reach Supabase Auth.',
    });

    const providerFailure = await runRuntimeSmoke(projectRoot, {
      action: 'signIn',
      fetchMode: 'http-error',
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
    expect(providerFailure.requests).toHaveLength(1);
    expectAuthError(providerFailure.signIn, {
      code: 'validation_error',
      message: 'Email rate limit exceeded',
    });

    const afterUrlChange = await runRuntimeSmoke(projectRoot, {
      action: 'signIn',
      fetchMode: 'success',
      supabaseUrl: UPDATED_SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    });
    expect(afterUrlChange.requests[0]?.url).toBe(
      `${UPDATED_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    );
    expect(await readFile(path.join(projectRoot, 'src/auth/adapter.ts'), 'utf8')).toBe(
      adapterSourceBefore,
    );
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}, 45_000);

test('Expo Babel bundling statically embeds generated Supabase public env values', async () => {
  const { workspaceRoot, projectRoot } = await createGeneratedProject();

  try {
    const loadedBabel = requireAggregateModule('@babel/core');
    if (!isBabelCore(loadedBabel)) {
      throw new TypeError('Unable to load @babel/core for the Expo env smoke test.');
    }

    const presetExpo = requireAggregateModule('babel-preset-expo');
    const previousUrl = readEnvString('EXPO_PUBLIC_SUPABASE_URL');
    const previousAnonKey = readEnvString('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

    try {
      const adapterSource = await readFile(path.join(projectRoot, 'src/auth/adapter.ts'), 'utf8');
      const transformed = await loadedBabel.transformAsync(adapterSource, {
        babelrc: false,
        caller: {
          name: 'expo-env-smoke',
          bundler: 'metro',
          platform: 'web',
          isDev: false,
        },
        configFile: false,
        filename: path.join(projectRoot, 'src/auth/adapter.ts'),
        presets: [presetExpo],
      });
      const bundledJavaScript = transformed?.code ?? '';

      expect(bundledJavaScript).toContain(SUPABASE_URL);
      expect(bundledJavaScript).toContain(SUPABASE_ANON_KEY);
      expect(bundledJavaScript).not.toContain('process.env.EXPO_PUBLIC_SUPABASE_URL');
      expect(bundledJavaScript).not.toContain('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY');
    } finally {
      if (previousUrl === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
      }
      if (previousAnonKey === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
      }
    }
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}, 45_000);
