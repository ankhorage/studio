import { readFile, writeFile } from 'node:fs/promises';

async function replaceInFile(path: string, transform: (source: string) => string): Promise<void> {
  const source = await readFile(path, 'utf8');
  const next = transform(source);
  if (next === source) return;
  await writeFile(path, next, 'utf8');
}

function requireReplace(source: string, before: string, after: string, label: string): string {
  if (!source.includes(before)) throw new Error(`Missing replacement target: ${label}`);
  return source.replace(before, after);
}

await replaceInFile('src/projectAuthHealth.ts', (source) =>
  source
    .replace(
      "import type { AppEnvironmentId, AppDeployTargetId } from '@ankhorage/contracts/deploy';",
      "import type { AppDeployTargetId } from '@ankhorage/contracts/deploy';",
    )
    .replace(
      "import { APP_ENVIRONMENT_IDS, type AppEnvironmentId } from '@ankhorage/contracts/environments';",
      "import type { AppEnvironmentId } from '@ankhorage/contracts/environments';",
    )
    .replace(
      '  const { auth } = input.manifest.infra;',
      '  const auth = input.manifest.infra.environments[environment]?.auth;',
    )
    .replaceAll("path: 'infra.auth'", "path: `infra.environments.${environment}.auth`")
    .replaceAll(
      "path: 'infra.auth.profile'",
      "path: `infra.environments.${environment}.auth.profile`",
    )
    .replaceAll(
      "path: 'infra.auth.oauth.providers'",
      "path: `infra.environments.${environment}.auth.oauth.providers`",
    )
    .replace(
      '  const path = `infra.auth.oauth.providers[${input.index}]`;',
      '  const path = `infra.environments.${input.setupPlan.environment}.auth.oauth.providers[${input.index}]`;'
    ),
);

await replaceInFile('src/projectDeployRuntimeInput.ts', (source) =>
  source
    .replace("import type { AppEnvironmentId } from '@ankhorage/contracts/deploy';\n", '')
    .replace(
      "import { APP_ENVIRONMENT_IDS, type AppEnvironmentId } from '@ankhorage/contracts/environments';",
      "import type { AppEnvironmentId } from '@ankhorage/contracts/environments';",
    ),
);

await replaceInFile('src/ui/admin/pages/AuthAdminPage.tsx', (source) =>
  source
    .replace("import { APP_ENVIRONMENT_IDS } from '@ankhorage/contracts/deploy';\n", '')
    .replace(
      "import { APP_ENVIRONMENT_IDS, type AppEnvironmentId } from '@ankhorage/contracts/environments';",
      "import { APP_ENVIRONMENT_IDS, type AppEnvironmentId } from '@ankhorage/contracts/environments';",
    )
    .replace(
      '() => readStudioAuthSettings(manifest ?? createFallbackManifest()) ?? createDefaultSettings(),',
      "() => readStudioAuthSettings(manifest ?? createFallbackManifest(), 'local') ?? createDefaultSettings(),",
    )
    .replace(
      'setDraft(readStudioAuthSettings(manifest) ?? createDefaultSettings());',
      'setDraft(readStudioAuthSettings(manifest, environment) ?? createDefaultSettings());',
    )
    .replaceAll(
      'readStudioAuthSettings(canonicalManifestRef.current)',
      'readStudioAuthSettings(canonicalManifestRef.current, environment)',
    )
    .replace(
      '  }, [manifest]);',
      '  }, [environment, manifest]);',
    ),
);

await replaceInFile('src/authSettings.ts', (source) => {
  let next = source;
  next = requireReplace(
    next,
    "import { type AppManifest, DEFAULT_AUTH_FLOW } from '@ankhorage/contracts';",
    "import { type AppManifest, DEFAULT_AUTH_FLOW } from '@ankhorage/contracts';\nimport type { AppEnvironmentId } from '@ankhorage/contracts/environments';\nimport type { InfraEnvironmentSpec } from '@ankhorage/contracts/infra';",
    'authSettings imports',
  );
  next = requireReplace(
    next,
    "type ManifestAuth = NonNullable<AppManifest['infra']['auth']>;",
    "type ManifestAuth = NonNullable<InfraEnvironmentSpec['auth']>;",
    'authSettings ManifestAuth',
  );
  next = requireReplace(
    next,
    'export function readStudioAuthSettings(manifest: AppManifest): StudioAuthSettings | null {\n  const { auth } = manifest.infra;',
    "export function readStudioAuthSettings(\n  manifest: AppManifest,\n  environment: AppEnvironmentId = 'local',\n): StudioAuthSettings | null {\n  const auth = manifest.infra.environments[environment]?.auth;",
    'readStudioAuthSettings',
  );
  const start = next.indexOf('export function applyStudioAuthSettings(');
  const end = next.indexOf('/***\n * Validate an unknown authored auth configuration', start);
  if (start === -1 || end === -1) throw new Error('Cannot locate applyStudioAuthSettings block');
  const replacement = `export function applyStudioAuthSettings(\n  manifest: AppManifest,\n  settings: StudioAuthSettings,\n  environment: AppEnvironmentId = 'local',\n): AppManifest {\n  const current = manifest.infra.environments[environment];\n  if (!current) {\n    throw new Error(\`Project '\${manifest.metadata.slug}' does not configure infrastructure environment '\${environment}'.\`);\n  }\n\n  const auth: ManifestAuth = {\n    scope: settings.scope,\n    provider: settings.provider,\n    flow: { ...settings.flow },\n    signIn: { identifiers: [...settings.signIn.identifiers] },\n    ...(settings.signUp\n      ? {\n          signUp: {\n            requiredFields: [...settings.signUp.requiredFields],\n            ...(settings.signUp.optionalFields\n              ? { optionalFields: [...settings.signUp.optionalFields] }\n              : {}),\n            ...(settings.signUp.signUpPolicy\n              ? { signUpPolicy: settings.signUp.signUpPolicy }\n              : {}),\n          },\n        }\n      : {}),\n    ...(settings.oauth\n      ? {\n          oauth: {\n            enabled: settings.oauth.enabled,\n            callbackRoute: settings.oauth.callbackRoute,\n            providers: settings.oauth.providers.map(cloneOAuthProvider),\n          },\n        }\n      : {}),\n    ...(settings.profile\n      ? {\n          profile: {\n            fields: [...settings.profile.fields],\n            ...(settings.profile.table ? { table: settings.profile.table } : {}),\n            ...(settings.profile.primaryKey ? { primaryKey: settings.profile.primaryKey } : {}),\n            ...(settings.profile.createStrategy\n              ? { createStrategy: settings.profile.createStrategy }\n              : {}),\n            ...(settings.profile.updateStrategy\n              ? { updateStrategy: settings.profile.updateStrategy }\n              : {}),\n          },\n        }\n      : {}),\n  };\n\n  return {\n    ...manifest,\n    infra: {\n      ...manifest.infra,\n      environments: {\n        ...manifest.infra.environments,\n        [environment]: { ...current, auth },\n      },\n    },\n  };\n}\n\n`;
  return `${next.slice(0, start)}${replacement}${next.slice(end)}`;
});

await replaceInFile('src/core/studioManifestDraftModel.ts', (source) =>
  source.replace(
    "    const { auth: _auth, ...infra } = manifest.infra;\n    return { ...manifest, infra };",
    "    const local = manifest.infra.environments.local;\n    const { auth: _auth, ...localWithoutAuth } = local;\n    return {\n      ...manifest,\n      infra: {\n        ...manifest.infra,\n        environments: { ...manifest.infra.environments, local: localWithoutAuth },\n      },\n    };",
  ),
);

await replaceInFile('src/host/layout/auth/resolveAuthLayoutPlan.ts', (source) =>
  source
    .replace('  const { auth } = manifest.infra;', '  const { auth } = manifest.infra.environments.local;')
    .replaceAll("AppManifest['infra']['auth']", "AppManifest['infra']['environments']['local']['auth']"),
);

await replaceInFile('src/host/orchestrator/projectManager.ts', (source) =>
  source
    .replace(
      '  const { auth } = manifest.infra;',
      '  const { auth } = manifest.infra.environments.local;',
    )
    .replace(
      '  const { auth, database, storage } = manifest.infra;\n  if (storage?.provider !== \'auto\') return null;\n  const usesSupabase = auth?.provider === \'supabase\' || database?.provider === \'supabase\';',
      "  const { auth, database, objectStorage } = manifest.infra.environments.local;\n  if (objectStorage?.provider !== 'supabase') return null;\n  const usesSupabase = auth?.provider === 'supabase' || database?.provider === 'supabase';",
    ),
);

await replaceInFile('src/manifestSync.ts', (source) =>
  source.replace(
    '    auth: manifest.infra.environments.local.auth ?? null,',
    '    environments: manifest.infra.environments,',
  ),
);

await replaceInFile('src/projectSecretUsage.ts', (source) => {
  const start = source.indexOf('export function findProjectSecretUsages(');
  const end = source.indexOf('/***\n * Compare secret usages', start);
  if (start === -1 || end === -1) throw new Error('Cannot locate secret usage function');
  const replacement = `export function findProjectSecretUsages(input: {\n  readonly manifest: AppManifest;\n  readonly ref: string;\n}): ProjectSecretUsageSummary {\n  const usages = new Map<string, ProjectSecretUsage>();\n\n  Object.entries(input.manifest.infra.environments).forEach(([environmentId, environment]) => {\n    const providers = environment.auth?.oauth?.providers ?? [];\n    providers.forEach((provider) => {\n      if (provider.credentialsRef !== input.ref) return;\n\n      const ownerId = provider.id;\n      const label = \`\${provider.label ?? titleCaseIdentifier(ownerId)} OAuth provider\`;\n      const path = \`infra.environments.\${environmentId}.auth.oauth.providers[\${ownerId}].credentialsRef\`;\n      usages.set(\n        \`\${path}:\${input.ref}\`,\n        Object.freeze({\n          ref: input.ref,\n          path,\n          category: 'oauth-provider',\n          label,\n          ownerId,\n          breaksWhenMissing: provider.enabled === true,\n        }),\n      );\n    });\n  });\n\n  return {\n    ref: input.ref,\n    usages: [...usages.values()].sort(compareSecretUsages),\n  };\n}\n\n`;
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
});
