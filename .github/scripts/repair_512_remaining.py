from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    if old not in source:
        raise SystemExit(f"missing replacement in {path}: {old[:120]!r}")
    target.write_text(source.replace(old, new))


# Studio is the host for the default local provider composition, so the selected adapter packages
# must be resolvable from the published Studio runtime.
replace(
    'package.json',
    '    "@ankhorage/infra": "^5.1.2",\n    "@ankhorage/navigator":',
    '    "@ankhorage/infra": "^5.1.2",\n    "@ankhorage/local": "^0.3.0",\n    "@ankhorage/minikube": "^0.4.1",\n    "@ankhorage/navigator":',
)
replace(
    'package.json',
    '    "@ankhorage/supabase-auth": "^1.2.11",',
    '    "@ankhorage/supabase": "^0.4.5",\n    "@ankhorage/supabase-auth": "^1.2.11",',
)
replace('package.json', '"@ankhorage/supabase-vault": "^0.2.11"', '"@ankhorage/supabase-vault": "^0.3.1"')

# Safe environment access without generic object-injection sinks.
replace(
    'src/authSettings.ts',
    "import { hasOnlyKeys, isRecord } from '@ankhorage/utility/object';",
    "import { hasOnlyKeys, isRecord, readOwnProperty } from '@ankhorage/utility/object';",
)
replace(
    'src/authSettings.ts',
    '  const auth = manifest.infra.environments[environment]?.auth;',
    '  const auth = readOwnProperty(manifest.infra.environments, environment)?.auth;',
)
replace(
    'src/authSettings.ts',
    '  const current = manifest.infra.environments[environment];',
    '  const current = readOwnProperty(manifest.infra.environments, environment);',
)
replace(
    'src/authSettings.ts',
    "      environments: {\n        ...manifest.infra.environments,\n        [environment]: { ...current, auth },\n      },",
    "      environments: replaceAuthEnvironment(\n        manifest.infra.environments,\n        environment,\n        { ...current, auth },\n      ),",
)
insert_marker = '/***\n * Validate an unknown authored auth configuration and return the canonical Studio auth settings shape.'
replace(
    'src/authSettings.ts',
    insert_marker,
    "/*** Replace one explicit Infra environment without dynamic property assignment. */\nfunction replaceAuthEnvironment(\n  environments: AppManifest['infra']['environments'],\n  environment: AppEnvironmentId,\n  value: InfraEnvironmentSpec,\n): AppManifest['infra']['environments'] {\n  if (environment === 'local') return { ...environments, local: value };\n  if (environment === 'preview') return { ...environments, preview: value };\n  return { ...environments, production: value };\n}\n\n" + insert_marker,
)

replace(
    'src/projectAuthHealth.ts',
    "import type { AppManifest } from '@ankhorage/contracts';",
    "import type { AppManifest } from '@ankhorage/contracts';\nimport { readOwnProperty } from '@ankhorage/utility/object';",
)
replace(
    'src/projectAuthHealth.ts',
    '  const auth = input.manifest.infra.environments[environment]?.auth;',
    '  const auth = readOwnProperty(input.manifest.infra.environments, environment)?.auth;',
)
replace(
    'src/host/auth/projectAuthHealthService.ts',
    "import type { ProjectAuthHealth } from '../../projectAuthHealth';",
    "import { readOwnProperty } from '@ankhorage/utility/object';\n\nimport type { ProjectAuthHealth } from '../../projectAuthHealth';",
)
replace(
    'src/host/auth/projectAuthHealthService.ts',
    '    const environmentSpec = manifest.infra.environments[environment];',
    '    const environmentSpec = readOwnProperty(manifest.infra.environments, environment);',
)
replace(
    'src/host/auth/projectAuthHealthService.ts',
    '      const runtimeDiagnostics = await observeProjectAuthRuntimeDiagnostics({',
    '      const runtimeDiagnostics = observeProjectAuthRuntimeDiagnostics({',
)

# The diagnostics observer is synchronous after the provider-neutral migration.
cli = Path('src/cli/index.ts')
cli.write_text(cli.read_text().replace('await observeProjectAuthRuntimeDiagnostics(', 'observeProjectAuthRuntimeDiagnostics('))

# The rollout status is an implementation detail of the exported diagnostics object.
replace(
    'src/projectAuthRuntimeDiagnostics.ts',
    'export type ProjectAuthRuntimeRolloutStatus =',
    'type ProjectAuthRuntimeRolloutStatus =',
)

# Remove unused migration helpers rather than retaining another environment update path.
for obsolete in (
    'src/features/infrastructure/application/use-cases/resolveProjectInfraEnvironment.ts',
    'src/features/infrastructure/application/use-cases/updateProjectInfraEnvironment.ts',
    'src/host/utils/trimOutput.ts',
):
    Path(obsolete).unlink(missing_ok=True)

# Current Contracts 19 auth settings fixtures.
replace(
    'src/authSettings.test.ts',
    "    expect(next.infra.environments.local.auth?.authorization).toEqual({\n      kind: 'RBAC',\n      engine: 'native',\n    });\n",
    '',
)
replace(
    'src/authSettings.test.ts',
    "    const manifest = createManifest();\n    if (!manifest.infra.environments.local.auth) throw new Error('Expected auth fixture.');\n    delete manifest.infra.environments.local.auth.flow;\n    delete manifest.infra.environments.local.auth.signIn;\n\n    const settings = readStudioAuthSettings(manifest);",
    "    const manifest = createManifest();\n    const auth = manifest.infra.environments.local.auth;\n    if (!auth) throw new Error('Expected auth fixture.');\n    const { flow: _flow, signIn: _signIn, ...authWithoutDefaults } = auth;\n    const withoutDefaults: AppManifest = {\n      ...manifest,\n      infra: {\n        ...manifest.infra,\n        environments: {\n          ...manifest.infra.environments,\n          local: { ...manifest.infra.environments.local, auth: authWithoutDefaults },\n        },\n      },\n    };\n\n    const settings = readStudioAuthSettings(withoutDefaults);",
)

# Nest authored auth under environments.local in the admin smoke fixture.
replace(
    'src/host/generatedAdminExpoWeb.smoke.test.ts',
    "    infra: {\n      ...nutritionManifest.infra,\n      auth: {",
    "    infra: {\n      ...nutritionManifest.infra,\n      environments: {\n        ...nutritionManifest.infra.environments,\n        local: {\n          ...nutritionManifest.infra.environments.local,\n          auth: {",
)
replace(
    'src/host/generatedAdminExpoWeb.smoke.test.ts',
    "        },\n      },\n    },\n    navigator:",
    "        },\n          },\n        },\n      },\n    },\n    navigator:",
)

# Immutable readonly fixture updates.
replace(
    'src/host/layout/authRootBootstrap.test.ts',
    "  const manifest = createAuthManifest('index');\n  if (!manifest.infra.environments.local.auth)\n    throw new Error('Expected auth fixture configuration.');\n  manifest.infra.environments.local.auth = { ...manifest.infra.environments.local.auth, scope };\n  return new GeneratedAppFileGenerator().generateFiles(",
    "  const base = createAuthManifest('index');\n  const auth = base.infra.environments.local.auth;\n  if (!auth) throw new Error('Expected auth fixture configuration.');\n  const manifest: AppManifest = {\n    ...base,\n    infra: {\n      ...base.infra,\n      environments: {\n        ...base.infra.environments,\n        local: { ...base.infra.environments.local, auth: { ...auth, scope } },\n      },\n    },\n  };\n  return new GeneratedAppFileGenerator().generateFiles(",
)

# Layout tests only need immutable networking variants.
layout = Path('src/host/layout/layoutGenerator.test.ts')
layout_source = layout.read_text()
layout_source = layout_source.replace(
    "    publicManifest.infra.environments.local.networking = { publicBaseUrl: 'https://app.example' };",
    "    publicManifest = {\n      ...publicManifest,\n      infra: {\n        ...publicManifest.infra,\n        environments: {\n          ...publicManifest.infra.environments,\n          local: {\n            ...publicManifest.infra.environments.local,\n            networking: { publicBaseUrl: 'https://app.example' },\n          },\n        },\n      },\n    };",
)
layout_source = layout_source.replace(
    "    manifest.infra.environments.local.networking = { publicBaseUrl: 'https://app.example' };",
    "    manifest = {\n      ...manifest,\n      infra: {\n        ...manifest.infra,\n        environments: {\n          ...manifest.infra.environments,\n          local: {\n            ...manifest.infra.environments.local,\n            networking: { publicBaseUrl: 'https://app.example' },\n          },\n        },\n      },\n    };",
)
layout.write_text(layout_source)

# Splash width is no longer part of the current manifest contract.
creation_assets = Path('src/host/orchestrator/projectCreationAssets.test.ts')
creation_assets.write_text(creation_assets.read_text().replace('      imageWidth: 240,\n', '').replace('        imageWidth: 240,\n', ''))

# Current project deletion uses the typed Infra lifecycle port.
Path('src/host/orchestrator/projectManagerDeletion.test.ts').write_text(r'''import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import type { InfraLedger } from '@ankhorage/contracts/infra';
import { expect, test } from 'bun:test';

import type { StudioProjectInfraLifecycle } from '../../features/infrastructure/composition/createStudioProjectInfraLifecycle';
import { ProjectManager } from './projectManager';

test('deleteProject destroys generated Infra before project file removal', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const calls: string[] = [];
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: (request) => {
        calls.push(`destroy:${request.projectId}:${request.deletePersistentResources}`);
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    }),
  });

  const result = await manager.deleteProject('demo');

  expect(result).toEqual({ success: true, infraDestroyed: true, projectFilesDeleted: true });
  expect(calls).toEqual(['destroy:demo:true']);
  await expectRejects(() => readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8'));
});

test('deleteProject fails clearly and preserves files when Infra destroy fails', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: () => Promise.reject(new Error('destroy failed')),
    }),
  });

  await expectRejects(() => manager.deleteProject('demo'), /destroy failed/u);
  expect(await readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8')).toContain('@demo/app');
});

test('deleteProject destroys only the requested project', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo-a');
  await createProject(rootPath, 'demo-b');
  const destroyed: string[] = [];
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: (request) => {
        destroyed.push(request.projectId);
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    }),
  });

  await manager.deleteProject('demo-a');

  expect(destroyed).toEqual(['demo-a']);
  await expectRejects(() => readFile(path.join(rootPath, 'apps', 'demo-a', 'package.json'), 'utf8'));
  expect(await readFile(path.join(rootPath, 'apps', 'demo-b', 'package.json'), 'utf8')).toContain('@demo-b/app');
});

function createInfraLifecycle(
  overrides: Partial<StudioProjectInfraLifecycle> = {},
): StudioProjectInfraLifecycle {
  const ledger: InfraLedger = {
    schemaVersion: 1,
    projectId: 'fixture',
    environment: 'local',
    targets: [],
    resources: [],
    outputs: [],
    artifacts: [],
  };
  return {
    generateAsync: () => Promise.resolve({ environment: 'local', artifacts: [], ledger }),
    upAsync: () => Promise.resolve({ environment: 'local', targets: [], resources: [], outputs: [], ledger }),
    statusAsync: (request) => Promise.resolve({ projectId: request.projectId, environment: 'local', state: 'ready', resources: [] }),
    outputsAsync: () => Promise.resolve({ environment: 'local', outputs: [] }),
    downAsync: () => Promise.resolve({ environment: 'local', ledger }),
    destroyAsync: () => Promise.resolve({ environment: 'local', ledger: null }),
    ...overrides,
  };
}

async function createWorkspace(): Promise<string> {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-delete-'));
  await mkdir(path.join(rootPath, 'apps', 'studio'), { recursive: true });
  await writeFile(path.join(rootPath, 'package.json'), JSON.stringify({ name: '@ankhorage/studio-test', private: true }));
  return rootPath;
}

async function createProject(rootPath: string, projectId: string): Promise<void> {
  const projectPath = path.join(rootPath, 'apps', projectId);
  await mkdir(projectPath, { recursive: true });
  await writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: `@${projectId}/app` }));
  await writeFile(path.join(projectPath, 'ankh.config.json'), JSON.stringify(createManifest(projectId)));
}

function createManifest(projectId: string): AppManifest {
  return {
    metadata: { name: projectId, slug: projectId, version: '1.0.0', category: 'developer_tools', themeId: 'default' },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: { compute: { provider: 'local' }, runtime: { provider: 'minikube' } },
          auth: { scope: 'global', provider: 'supabase' },
          database: { provider: 'supabase', tier: 'dev' },
          objectStorage: { provider: 'supabase', buckets: ['avatars'] },
          secretStore: { provider: 'supabase-vault' },
        },
      },
      modules: [],
    },
    navigator: { type: 'stack', initialRouteName: 'index', routes: [{ name: 'index', screenId: 'index' }] },
    screens: { index: { id: 'index', name: 'Index', root: { id: 'root', type: 'Page' } } },
    themes: [],
    activeThemeId: 'default',
  };
}

async function expectRejects(operation: () => Promise<unknown>, expectedMessage?: RegExp): Promise<void> {
  try {
    await operation();
    throw new Error('Expected operation to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (expectedMessage) expect((error as Error).message).toMatch(expectedMessage);
  }
}
''')

# Current Studio Infra up result is runtime/regenerated/reconciled, with no script or port-forward layer.
Path('src/host/orchestrator/studioInfraUp.test.ts').write_text(r'''import type { AppManifest } from '@ankhorage/contracts';
import type { InfraGenerateResult, InfraUpResult } from '@ankhorage/infra';
import { describe, expect, test } from 'bun:test';

import { upProjectInfrastructure } from './studioInfraUp';

const manifest: AppManifest = {
  metadata: { name: 'Demo', slug: 'demo', version: '1.0.0', category: 'developer_tools', themeId: 'default' },
  settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  infra: {
    environments: { local: { deployment: { compute: { provider: 'local' }, runtime: { provider: 'minikube' } } } },
    modules: [],
  },
  navigator: { type: 'stack', routes: [] },
  screens: {},
  themes: [],
  activeThemeId: 'default',
};
const ledger = { schemaVersion: 1 as const, projectId: 'project-one', environment: 'local' as const, targets: [], resources: [], outputs: [], artifacts: [] };
const regenerated: InfraGenerateResult = { environment: 'local', artifacts: [], ledger };
const reconciled: InfraUpResult = { environment: 'local', targets: [], resources: [], outputs: [], ledger };

describe('Studio Infrastructure Up', () => {
  test('regenerates and reconciles through the provider-neutral project manager boundary', async () => {
    const calls: string[] = [];
    const result = await upProjectInfrastructure({
      projectId: 'project-one',
      workspaceRoot: '/workspace',
      projectManager: {
        regenerateInfrastructure: (projectId) => {
          calls.push(`regenerate:${projectId}`);
          return Promise.resolve(regenerated);
        },
        getProjectManifest: (projectId) => {
          calls.push(`manifest:${projectId}`);
          return Promise.resolve(manifest);
        },
        upInfrastructure: (projectId) => {
          calls.push(`up:${projectId}`);
          return Promise.resolve(reconciled);
        },
      },
    });

    expect(result).toEqual({
      runtime: 'minikube',
      regenerated,
      reconciled,
      trustedOAuth: { deferred: false },
    });
    expect(calls).toEqual(['regenerate:project-one', 'manifest:project-one', 'up:project-one']);
  });
});
''')

# Trusted database URL is now synchronous and host-env-only.
Path('src/host/secrets/resolveProjectSecretDatabaseUrl.test.ts').write_text(r'''import { describe, expect, test } from 'bun:test';

import { resolveProjectSecretDatabaseUrl } from './resolveProjectSecretDatabaseUrl';

describe('resolveProjectSecretDatabaseUrl', () => {
  test('reads the trusted host database URL from the explicit process environment', () => {
    expect(
      resolveProjectSecretDatabaseUrl({
        processEnvironment: { ANKH_SECRET_STORE_DATABASE_URL: ' postgres://trusted/database ' },
      }),
    ).toBe('postgres://trusted/database');
  });

  test('rejects missing trusted host configuration without inspecting public Infra outputs', () => {
    expect(() => resolveProjectSecretDatabaseUrl({ processEnvironment: {} })).toThrow(
      'ANKH_SECRET_STORE_DATABASE_URL',
    );
  });
});
''')

# Canonical smoke fixture auth ownership.
replace(
    'src/host/smoke/createOAuthFixtureManifest.ts',
    "    infra: {\n      ...base.infra,\n      auth: {\n        ...base.infra.environments.local.auth,\n        scope: base.infra.environments.local.auth?.scope ?? 'global',\n        provider: base.infra.environments.local.auth?.provider ?? 'supabase',\n        oauth: fixture.oauth,\n      },\n    },",
    "    infra: {\n      ...base.infra,\n      environments: {\n        ...base.infra.environments,\n        local: {\n          ...base.infra.environments.local,\n          auth: {\n            ...base.infra.environments.local.auth,\n            scope: base.infra.environments.local.auth?.scope ?? 'global',\n            provider: base.infra.environments.local.auth?.provider ?? 'supabase',\n            oauth: fixture.oauth,\n          },\n        },\n      },\n    },",
)

nav = Path('src/host/smoke/createExpo57NavigationFixtureManifest.ts')
source = nav.read_text()
source = source.replace(
    "  const { auth: _baseAuth, ...baseInfra } = baseManifest.infra;",
    "  const { auth: _baseAuth, ...baseLocalEnvironment } = baseManifest.infra.environments.local;",
)
old = """    infra: {
      ...baseInfra,
      ...(auth
        ? {
            auth: {
              scope: authScope,
              provider: 'supabase' as const,
              flow: {
                signInRoute: 'sign-in',
                signUpRoute: 'sign-up',
                signOutRoute: 'sign-out',
                postSignInRoute,
                unauthorizedRoute: 'sign-in',
              },
              signIn: { identifiers: ['email' as const] },
              signUp: { requiredFields: ['email' as const, 'password' as const] },
              oauth: { enabled: false, callbackRoute: 'auth/callback', providers: [] },
            },
          }
        : {}),
    },"""
new = """    infra: {
      ...baseManifest.infra,
      environments: {
        ...baseManifest.infra.environments,
        local: {
          ...baseLocalEnvironment,
          ...(auth
            ? {
                auth: {
                  scope: authScope,
                  provider: 'supabase' as const,
                  flow: {
                    signInRoute: 'sign-in',
                    signUpRoute: 'sign-up',
                    signOutRoute: 'sign-out',
                    postSignInRoute,
                    unauthorizedRoute: 'sign-in',
                  },
                  signIn: { identifiers: ['email' as const] },
                  signUp: { requiredFields: ['email' as const, 'password' as const] },
                  oauth: { enabled: false, callbackRoute: 'auth/callback', providers: [] },
                },
              }
            : {}),
        },
      },
    },"""
if old not in source:
    raise SystemExit('missing navigation fixture infra block')
nav.write_text(source.replace(old, new))

# Runtime label replaced the old target field.
prep = Path('src/host/smoke/prepareAuth5NativeOAuthSmokeInfra.ts')
prep.write_text(prep.read_text().replace('infraResult.target', 'infraResult.runtime'))

# Preserve the acceptance intent of disabling auth, but remove it from environments.local.
replace(
    'src/host/smoke/runExpo57GeneratedAppAcceptance.ts',
    '  const { auth: _auth, ...infra } = manifest.infra;',
    "  const { auth: _auth, ...localEnvironment } = manifest.infra.environments.local;\n  const infra: AppManifest['infra'] = {\n    ...manifest.infra,\n    environments: { ...manifest.infra.environments, local: localEnvironment },\n  };",
)

# Runtime signatures now observe the canonical environment-owned auth state.
replace(
    'src/manifestSync.test.ts',
    "    const createAuthInfra = (signInRoute: string): StudioManifest['infra'] => ({\n      auth: {\n        scope: 'global',\n        provider: 'supabase',\n        flow: {\n          signInRoute,\n          postSignInRoute: '/',\n        },\n      },\n      modules: [],\n    });",
    "    const createAuthInfra = (signInRoute: string): StudioManifest['infra'] => ({\n      environments: {\n        local: {\n          deployment: {\n            compute: { provider: 'local' },\n            runtime: { provider: 'minikube' },\n          },\n          auth: {\n            scope: 'global',\n            provider: 'supabase',\n            flow: { signInRoute, postSignInRoute: '/' },\n          },\n        },\n      },\n      modules: [],\n    });",
)

# The broad manifest-state fixture must expose the canonical local environment before OAuth mutation.
replace(
    'src/manifestState.test.ts',
    '    infra: { modulesConfig: {} },',
    "    infra: {\n      environments: {\n        local: {\n          deployment: {\n            compute: { provider: 'local' },\n            runtime: { provider: 'minikube' },\n          },\n        },\n      },\n      modules: [],\n      modulesConfig: {},\n    },",
)

# Secret usage path assertions follow the current environment-scoped path.
usage = Path('src/projectSecretUsage.test.ts')
usage.write_text(
    usage.read_text().replace(
        'infra.auth.oauth.providers[',
        'infra.environments.local.auth.oauth.providers[',
    )
)

# The environment-specific health test must author that environment instead of relying on fallback.
health_test = Path('src/projectAuthHealth.test.ts')
health_source = health_test.read_text()
health_source = health_source.replace("      environment: 'production',", "      environment: 'local',")
health_source = health_source.replace("{ environment: 'production', targets: ['web'] }", "{ environment: 'local', targets: ['web'] }")
health_test.write_text(health_source)

# Host lifecycle smoke uses a deterministic lifecycle fake while testing Studio ownership, not provider execution.
host = Path('src/host/hostLifecycle.smoke.test.ts')
host_source = host.read_text()
host_source = host_source.replace(
    "import { expect, test } from 'bun:test';",
    "import type { InfraLedger } from '@ankhorage/contracts/infra';\nimport { expect, test } from 'bun:test';\n\nimport type { StudioProjectInfraLifecycle } from '../features/infrastructure/composition/createStudioProjectInfraLifecycle';",
)
host_source = host_source.replace(
    "  const projectManager = new ProjectManager(workspaceRoot, {\n    runProjectInfrastructureLifecycle: () => Promise.resolve({ stderr: '', stdout: '' }),\n  });",
    "  const projectManager = new ProjectManager(workspaceRoot, { infraLifecycle: createInfraLifecycle() });",
)
host_source += r'''

function createInfraLifecycle(): StudioProjectInfraLifecycle {
  const ledger: InfraLedger = {
    schemaVersion: 1,
    projectId: 'host-smoke',
    environment: 'local',
    targets: [],
    resources: [],
    outputs: [],
    artifacts: [],
  };
  return {
    generateAsync: () => Promise.resolve({ environment: 'local', artifacts: [], ledger }),
    upAsync: () => Promise.resolve({ environment: 'local', targets: [], resources: [], outputs: [], ledger }),
    statusAsync: (request) => Promise.resolve({ projectId: request.projectId, environment: 'local', state: 'ready', resources: [] }),
    outputsAsync: () => Promise.resolve({ environment: 'local', outputs: [] }),
    downAsync: () => Promise.resolve({ environment: 'local', ledger }),
    destroyAsync: () => Promise.resolve({ environment: 'local', ledger: null }),
  };
}
'''
host.write_text(host_source)

Path('repair-512-report.txt').unlink(missing_ok=True)
