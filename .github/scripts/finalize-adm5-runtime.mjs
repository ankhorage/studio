import fs from 'node:fs';

function replaceExactly(path, before, after, expected = 1) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}: ${before.slice(0, 100)}`);
  }
  fs.writeFileSync(path, source.split(before).join(after));
}

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.devDependencies['@ankhorage/supabase-db'] = '^1.0.0';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

replaceExactly(
  'src/host/layout/templates/rootLayout.ts',
  '  authRuntime?: RootLayoutAuthRuntimeConfig;\n  initialRouteNameOverride?: string;',
  '  authRuntime?: RootLayoutAuthRuntimeConfig;\n  databaseAdaptersExpression?: string;\n  initialRouteNameOverride?: string;',
);
replaceExactly(
  'src/host/layout/templates/rootLayout.ts',
  '    authRuntime,\n    initialRouteNameOverride,',
  '    authRuntime,\n    databaseAdaptersExpression,\n    initialRouteNameOverride,',
);
replaceExactly(
  'src/host/layout/templates/rootLayout.ts',
  '      createRuntimeDataSourceOperationExecutor({\n        fetch: runtimeDataSourceFetch,',
  "      createRuntimeDataSourceOperationExecutor({\n        ${databaseAdaptersExpression ? `databaseAdapters: ${databaseAdaptersExpression},` : ''}\n        fetch: runtimeDataSourceFetch,",
);

replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  "import type { StudioAdminRouteId } from '../../index';",
  "import type { StudioAdminRouteId } from '../../index';\nimport { resolveGeneratedDatabaseRuntime } from '../generatedDatabaseRuntime';",
);
replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  "import { composeGeneratedImports } from './generatedImportComposer';",
  "import { composeGeneratedImports } from './generatedImportComposer';\nimport {\n  GENERATED_DATABASE_ADAPTERS_EXPRESSION,\n  getGeneratedDatabaseRuntimeImports,\n  getGeneratedDatabaseRuntimeModuleDeclarations,\n} from './generatedDatabaseRuntimeSource';",
);
replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  '    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);',
  '    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);\n    const databaseRuntime = resolveGeneratedDatabaseRuntime(manifest);',
  2,
);
replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  '      getPackageOwnedRuntimeImports(),',
  '      getPackageOwnedRuntimeImports(),\n      ...getGeneratedDatabaseRuntimeImports(databaseRuntime),',
  2,
);
replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  "      authRuntime: authLayoutPlan,\n      initialRouteNameOverride: '(app)',\n      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(\n        getGeneratedRuntimeRegistryDeclarations(),\n        ...runtimeLayoutIntegration.moduleDeclarations,\n      ),",
  "      authRuntime: authLayoutPlan,\n      databaseAdaptersExpression:\n        databaseRuntime === null ? undefined : GENERATED_DATABASE_ADAPTERS_EXPRESSION,\n      initialRouteNameOverride: '(app)',\n      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(\n        getGeneratedRuntimeRegistryDeclarations(),\n        getGeneratedDatabaseRuntimeModuleDeclarations(databaseRuntime, true),\n        ...runtimeLayoutIntegration.moduleDeclarations,\n      ),",
);
replaceExactly(
  'src/host/layout/layoutGenerator.ts',
  '      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(\n        getGeneratedRuntimeRegistryDeclarations(),\n        ...runtimeLayoutIntegration.moduleDeclarations,\n      ),\n      runtimeProviderEnd:',
  '      databaseAdaptersExpression:\n        databaseRuntime === null ? undefined : GENERATED_DATABASE_ADAPTERS_EXPRESSION,\n      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(\n        getGeneratedRuntimeRegistryDeclarations(),\n        getGeneratedDatabaseRuntimeModuleDeclarations(databaseRuntime, false),\n        ...runtimeLayoutIntegration.moduleDeclarations,\n      ),\n      runtimeProviderEnd:',
);

replaceExactly(
  'src/host/orchestrator/templates.ts',
  "import type { SplashScreenSpec } from '@ankhorage/contracts';",
  "import type { SplashScreenSpec } from '@ankhorage/contracts';\n\nimport type { GeneratedDatabaseRuntimeProvider } from '../generatedDatabaseRuntime';",
);
replaceExactly(
  'src/host/orchestrator/templates.ts',
  "const CONTRACTS_VERSION = '^4.0.0';\nconst RUNTIME_VERSION = '^0.3.0';\nconst SUPABASE_AUTH_VERSION = '^1.1.2';",
  "const CONTRACTS_VERSION = '^4.0.2';\nconst DATA_SOURCES_VERSION = '^1.0.1';\nconst RUNTIME_VERSION = '^1.0.0';\nconst SUPABASE_AUTH_VERSION = '^1.1.2';\nconst SUPABASE_DB_VERSION = '^1.0.0';",
);
replaceExactly(
  'src/host/orchestrator/templates.ts',
  '  authProvider?: GeneratedAuthProvider;\n  storageProvider?: GeneratedStorageProvider;',
  '  authProvider?: GeneratedAuthProvider;\n  databaseRuntimeProvider?: GeneratedDatabaseRuntimeProvider | null;\n  storageProvider?: GeneratedStorageProvider;',
);
replaceExactly(
  'src/host/orchestrator/templates.ts',
  '    authProvider = null,\n    storageProvider = null,',
  '    authProvider = null,\n    databaseRuntimeProvider = null,\n    storageProvider = null,',
);
replaceExactly(
  'src/host/orchestrator/templates.ts',
  "      '@ankhorage/contracts': CONTRACTS_VERSION,\n      '@ankhorage/data-sources': 'latest',\n      '@ankhorage/runtime': RUNTIME_VERSION,",
  "      '@ankhorage/contracts': CONTRACTS_VERSION,\n      '@ankhorage/data-sources': DATA_SOURCES_VERSION,\n      '@ankhorage/runtime': RUNTIME_VERSION,",
);
replaceExactly(
  'src/host/orchestrator/templates.ts',
  "      ...(storageProvider === 'supabase' ? { '@ankhorage/supabase-storage': 'latest' } : {}),\n      '@ankhorage/zora': ZORA_VERSION,",
  "      ...(databaseRuntimeProvider === 'supabase'\n        ? { '@ankhorage/supabase-db': SUPABASE_DB_VERSION }\n        : {}),\n      ...(storageProvider === 'supabase' ? { '@ankhorage/supabase-storage': 'latest' } : {}),\n      '@ankhorage/zora': ZORA_VERSION,",
);

replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  "import { applySystemTemplates } from '../manifestSystem';",
  "import type { GeneratedDatabaseRuntimeProvider } from '../generatedDatabaseRuntime';\nimport { applySystemTemplates } from '../manifestSystem';",
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '  authProvider?: GeneratedAuthProvider;\n  storageProvider?: GeneratedStorageProvider;',
  '  authProvider?: GeneratedAuthProvider;\n  databaseRuntimeProvider?: GeneratedDatabaseRuntimeProvider | null;\n  storageProvider?: GeneratedStorageProvider;',
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '      authProvider = null,\n      storageProvider = null,',
  '      authProvider = null,\n      databaseRuntimeProvider = null,\n      storageProvider = null,',
  2,
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '      authProvider,\n      storageProvider,\n      zoraExtensions,',
  '      authProvider,\n      databaseRuntimeProvider,\n      storageProvider,\n      zoraExtensions,',
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '        authProvider,\n        storageProvider,\n        runtimePlan,',
  '        authProvider,\n        databaseRuntimeProvider,\n        storageProvider,\n        runtimePlan,',
  2,
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '    authProvider: GeneratedAuthProvider,\n    storageProvider: GeneratedStorageProvider,',
  '    authProvider: GeneratedAuthProvider,\n    databaseRuntimeProvider: GeneratedDatabaseRuntimeProvider | null,\n    storageProvider: GeneratedStorageProvider,',
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  "  const supabaseStudioTemplate = getPackageJson({\n    name: template.name,\n    includeStudio: true,\n    authProvider: 'supabase',\n    storageProvider: 'supabase',\n  });",
  "  const supabaseStudioTemplate = getPackageJson({\n    name: template.name,\n    includeStudio: true,\n    authProvider: 'supabase',\n    storageProvider: 'supabase',\n  });\n  const supabaseDatabaseTemplate = getPackageJson({\n    name: template.name,\n    databaseRuntimeProvider: 'supabase',\n  });",
);
replaceExactly(
  'src/host/orchestrator/scaffolder.ts',
  '    ...Object.keys(supabaseStudioTemplate.dependencies),\n    ...Object.keys(template.dependencies),',
  '    ...Object.keys(supabaseStudioTemplate.dependencies),\n    ...Object.keys(supabaseDatabaseTemplate.dependencies),\n    ...Object.keys(template.dependencies),',
);

replaceExactly(
  'src/host/orchestrator/projectManager.ts',
  "import { GeneratedAppFileGenerator } from '../layout/layoutGenerator';",
  "import { resolveGeneratedDatabaseRuntime } from '../generatedDatabaseRuntime';\nimport { GeneratedAppFileGenerator } from '../layout/layoutGenerator';",
);
replaceExactly(
  'src/host/orchestrator/projectManager.ts',
  '      authProvider: resolveGeneratedAuthProvider(scaffoldManifest),\n      runtimePlan: resolveExpoRuntimePlan(scaffoldManifest),',
  '      authProvider: resolveGeneratedAuthProvider(scaffoldManifest),\n      databaseRuntimeProvider: resolveGeneratedDatabaseRuntime(scaffoldManifest)?.provider ?? null,\n      runtimePlan: resolveExpoRuntimePlan(scaffoldManifest),',
);
replaceExactly(
  'src/host/orchestrator/projectManager.ts',
  '      authProvider: resolveGeneratedAuthProvider(manifest),\n      runtimePlan,',
  '      authProvider: resolveGeneratedAuthProvider(manifest),\n      databaseRuntimeProvider: resolveGeneratedDatabaseRuntime(manifest)?.provider ?? null,\n      runtimePlan,',
);

replaceExactly(
  'src/host/orchestrator/templates.test.ts',
  "    expect(dependencies['@ankhorage/contracts']).toBe('^4.0.0');\n    expect(dependencies['@ankhorage/runtime']).toBe('^0.3.0');",
  "    expect(dependencies['@ankhorage/contracts']).toBe('^4.0.2');\n    expect(dependencies['@ankhorage/data-sources']).toBe('^1.0.1');\n    expect(dependencies['@ankhorage/runtime']).toBe('^1.0.0');",
);
replaceExactly(
  'src/host/orchestrator/templates.test.ts',
  "  it('requires the first ZORA release that enforces interactionPolicy', () => {",
  "  it('adds the released Supabase DB adapter only for generated database runtime', () => {\n    const generatedDb = getPackageJson({\n      name: 'generated-db-app',\n      databaseRuntimeProvider: 'supabase',\n    });\n    const plain = getPackageJson({ name: 'plain-app' });\n\n    expect(generatedDb.dependencies['@ankhorage/supabase-db']).toBe('^1.0.0');\n    expect(plain.dependencies['@ankhorage/supabase-db']).toBeUndefined();\n  });\n\n  it('requires the first ZORA release that enforces interactionPolicy', () => {",
);

replaceExactly(
  'src/host/layout/generatedDatabaseRuntimeGeneration.test.ts',
  "  expect(rootLayout.content).toContain('databaseAdapters: GENERATED_DATABASE_ADAPTERS');\n  expect(rootLayout.content).not.toContain('serviceRole');",
  "  expect(rootLayout.content).toContain('databaseAdapters: GENERATED_DATABASE_ADAPTERS');\n  expect(rootLayout.content).toContain('fetch: generatedSupabaseDbFetch');\n  expect(rootLayout.content).toContain('getStoredAuthSession()');\n  expect(rootLayout.content).toContain(\"headers.set('Authorization'\");\n  expect(rootLayout.content).not.toContain('serviceRole');",
);

const changesetPath = '.changeset/adm-5-generated-api-authoring.md';
const changeset = fs.readFileSync(changesetPath, 'utf8');
if (!changeset.includes('Runtime 1 CRUD')) {
  fs.writeFileSync(
    changesetPath,
    `${changeset.trim()}\n- Wire generated Runtime 1 CRUD operations to released Supabase DB adapters through canonical generated API adapter IDs.\n`,
  );
}

const docsPath = 'docs/generated-api-authoring.md';
const docs = fs.readFileSync(docsPath, 'utf8');
if (!docs.includes('## Runtime database execution')) {
  fs.writeFileSync(
    docsPath,
    `${docs.trim()}\n\n## Runtime database execution\n\nGenerated apps using the supported Supabase database provider install the released Supabase DB adapter and register it under every database adapter ID referenced by canonical generated API desired state. Runtime 1 receives that registry through \`createRuntimeDataSourceOperationExecutor\`; Studio does not execute database operations itself. The generated client uses only \`EXPO_PUBLIC_SUPABASE_URL\` and \`EXPO_PUBLIC_SUPABASE_ANON_KEY\`. When an auth session exists, its access token replaces only the Supabase Authorization header so row-level security evaluates the current user while the anon key remains the client API key. Missing client-safe environment values intentionally leave the registry empty so Runtime returns its structured \`missing-adapter\` diagnostic.\n`,
  );
}
