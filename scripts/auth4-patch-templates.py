from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 match, got {count}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, got {count}: {old[:80]!r}')
    file.write_text(text.replace(old, new))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 regex match, got {count}: {pattern}')
    file.write_text(updated)


# Generated Expo config and package scripts consume canonical targets.
path = Path('src/host/orchestrator/templates.ts')
text = path.read_text()
text = text.replace(
    "import type { SplashScreenSpec } from '@ankhorage/contracts';\n",
    "import type { SplashScreenSpec } from '@ankhorage/contracts';\n"
    "import type {\n"
    "  AppDeployAndroidTargetConfig,\n"
    "  AppDeployIosTargetConfig,\n"
    "  AppDeployTargets,\n"
    "} from '@ankhorage/contracts/deploy';\n",
    1,
)
text = re.sub(
    r"const RESERVED_NATIVE_IDENTIFIER_SEGMENTS = new Set\([\s\S]*?\n\);\n\nfunction serializeStringLiteral",
    'function serializeStringLiteral',
    text,
    count=1,
)
text = re.sub(
    r"function createNativeIdentifierSegment\([\s\S]*?\nexport function getMetroConfigJs",
    """function serializeAndroidConfig(args: {
  target: AppDeployAndroidTargetConfig;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const permissions = resolveExpoRuntimeNativeOutput(args.runtimePlan).androidPermissions;
  const extraLines =
    permissions.length > 0 ? `\\n    permissions: ${serializeJsValue(permissions, 2)},` : '';
  const schemeLine = args.target.scheme
    ? `\\n    scheme: ${serializeStringLiteral(args.target.scheme)},`
    : '';

  return `{
    ...config.android,${extraLines}
    package: ${serializeStringLiteral(args.target.package)},${schemeLine}
  }`;
}

function serializeIosConfig(target: AppDeployIosTargetConfig): string {
  const schemeLine = target.scheme
    ? `\\n    scheme: ${serializeStringLiteral(target.scheme)},`
    : '';

  return `{
    ...config.ios,
    bundleIdentifier: ${serializeStringLiteral(target.bundleIdentifier)},${schemeLine}
  }`;
}

function serializeTargetSections(args: {
  targets: AppDeployTargets;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const sections: string[] = [];
  if (args.targets.android?.enabled) {
    sections.push(
      `  android: ${serializeAndroidConfig({ target: args.targets.android, runtimePlan: args.runtimePlan })},`,
    );
  }
  if (args.targets.ios?.enabled) {
    sections.push(`  ios: ${serializeIosConfig(args.targets.ios)},`);
  }
  if (args.targets.web?.enabled) {
    sections.push(`  web: {
    ...config.web,
    output: 'static',
    favicon: './assets/favicon.png',
  },`);
  }
  return sections.length > 0 ? `\\n${sections.join('\\n')}` : '';
}

export function getAppConfigTs({
  name,
  slug,
  targets,
  splashScreen = null,
  runtimePlan,
}: {
  name: string;
  slug: string;
  targets: AppDeployTargets;
  splashScreen?: SplashScreenSpec | null;
  runtimePlan?: ExpoRuntimePlan;
}) {
  const targetSections = serializeTargetSections({ targets, runtimePlan });
  return `import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = { ...config };
  delete baseConfig.scheme;
  delete baseConfig.android;
  delete baseConfig.ios;
  delete baseConfig.web;

  return {
    ...baseConfig,
    name: ${serializeStringLiteral(name)},
    slug: ${serializeStringLiteral(slug)},
    plugins: ${serializePluginsWithRuntimePlan({ splashScreen, runtimePlan })},${targetSections}
  };
};
`;
}

export function getMetroConfigJs""",
    text,
    count=1,
)
text = text.replace(
    "const EXPO_WEB_BROWSER_VERSION = '~15.0.11';\n",
    "const EXPO_WEB_BROWSER_VERSION = '~15.0.11';\n"
    "const LEGACY_WEB_ONLY_TARGETS = { web: { enabled: true } } as const satisfies AppDeployTargets;\n",
    1,
)
text = text.replace(
    "  storageProvider?: GeneratedStorageProvider;\n  runtimePlan?: ExpoRuntimePlan;\n}) {\n",
    "  storageProvider?: GeneratedStorageProvider;\n  runtimePlan?: ExpoRuntimePlan;\n  targets?: AppDeployTargets;\n}) {\n",
    1,
)
text = text.replace(
    "    storageProvider = null,\n    runtimePlan,\n  } = args;\n",
    "    storageProvider = null,\n    runtimePlan,\n    targets = LEGACY_WEB_ONLY_TARGETS,\n  } = args;\n",
    1,
)
text = text.replace(
    "      android: 'expo run:android',\n      ios: 'expo run:ios',\n      web: 'expo start --web',\n",
    "      ...(targets.android?.enabled ? { android: 'expo run:android' } : {}),\n"
    "      ...(targets.ios?.enabled ? { ios: 'expo run:ios' } : {}),\n"
    "      ...(targets.web?.enabled ? { web: 'expo start --web' } : {}),\n",
    1,
)
path.write_text(text)

# Scaffolding threads target desired state into every generated artifact and removes stale target scripts.
path = 'src/host/orchestrator/scaffolder.ts'
replace_once(
    path,
    "import type { AppCategory, AppManifest, SplashScreenSpec } from '@ankhorage/contracts';\n",
    "import type { AppCategory, AppManifest, SplashScreenSpec } from '@ankhorage/contracts';\n"
    "import type { AppDeployManifest, AppDeployTargets } from '@ankhorage/contracts/deploy';\n",
)
replace_once(
    path,
    "  runtimePlan?: ExpoRuntimePlan;\n}\n",
    "  runtimePlan?: ExpoRuntimePlan;\n  targets?: AppDeployTargets;\n}\n",
)
replace_once(
    path,
    "const MANAGED_SCRIPT_NAMES = ['lint', 'lint:fix', 'format', 'format:check'] as const;\n",
    "const REQUIRED_MANAGED_SCRIPT_NAMES = ['lint', 'lint:fix', 'format', 'format:check'] as const;\n"
    "const TARGET_SCRIPT_NAMES = ['android', 'ios', 'web'] as const;\n"
    "const LEGACY_WEB_ONLY_TARGETS = { web: { enabled: true } } as const satisfies AppDeployTargets;\n",
)
replace_once(
    path,
    "      zoraExtensions = [],\n      runtimePlan,\n    } = options;\n",
    "      zoraExtensions = [],\n      runtimePlan,\n      targets = LEGACY_WEB_ONLY_TARGETS,\n    } = options;\n",
)
replace_once(
    path,
    "      zoraExtensions,\n      runtimePlan,\n    );\n"
    "    await this.writeAppConfig(projectPath, appName, slug, splashScreen, runtimePlan);\n",
    "      zoraExtensions,\n      runtimePlan,\n      targets,\n    );\n"
    "    await this.writeAppConfig(projectPath, appName, slug, targets, splashScreen, runtimePlan);\n",
)
replace_once(
    path,
    "      splashScreen = null,\n      runtimePlan,\n    } = options;\n",
    "      splashScreen = null,\n      runtimePlan,\n      targets = LEGACY_WEB_ONLY_TARGETS,\n    } = options;\n",
)
replace_count(
    path,
    "        storageProvider,\n        runtimePlan,\n      }),\n",
    "        storageProvider,\n        runtimePlan,\n        targets,\n      }),\n",
    2,
)
replace_once(
    path,
    "      includeStudio,\n    );\n\n    await fs.writeFile(packageJsonPath",
    "      includeStudio,\n      targets,\n    );\n\n    await fs.writeFile(packageJsonPath",
)
replace_once(
    path,
    "    await this.writeAppConfig(projectPath, appName, slug, splashScreen, runtimePlan);\n",
    "    await this.writeAppConfig(projectPath, appName, slug, targets, splashScreen, runtimePlan);\n",
)
replace_once(
    path,
    "    category: AppCategory,\n  ) {\n",
    "    category: AppCategory,\n    deploy: AppDeployManifest,\n  ) {\n",
)
replace_once(
    path,
    "    const manifestWithCategory: AppManifest = {\n      ...templateData,\n      metadata: {\n",
    "    const manifestWithCategory: AppManifest = {\n      ...templateData,\n      deploy,\n      metadata: {\n",
)
regex_once(
    path,
    r"  private async writeAppConfig\([\s\S]*?\n  private async writeMetroConfig",
    """  private async writeAppConfig(
    dir: string,
    name: string,
    slug: string,
    targets: AppDeployTargets,
    splashScreen: SplashScreenSpec | null,
    runtimePlan?: ExpoRuntimePlan,
  ) {
    await fs.writeFile(
      path.join(dir, 'app.config.ts'),
      getAppConfigTs({ name, slug, targets, splashScreen, runtimePlan }),
      'utf8',
    );
  }

  private async writeMetroConfig""",
)
replace_once(
    path,
    "    zoraExtensions: readonly ZoraExtensionDefinition[],\n    runtimePlan?: ExpoRuntimePlan,\n  ) {\n",
    "    zoraExtensions: readonly ZoraExtensionDefinition[],\n"
    "    runtimePlan: ExpoRuntimePlan | undefined,\n"
    "    targets: AppDeployTargets,\n"
    "  ) {\n",
)
replace_once(
    path,
    "function mergePackageJson(\n"
    "  existing: ExtendedPackageJsonShape | null,\n"
    "  template: ExtendedPackageJsonShape,\n"
    "  includeStudio: boolean,\n"
    ") {\n",
    "function mergePackageJson(\n"
    "  existing: ExtendedPackageJsonShape | null,\n"
    "  template: ExtendedPackageJsonShape,\n"
    "  includeStudio: boolean,\n"
    "  targets: AppDeployTargets,\n"
    ") {\n",
)
replace_once(
    path,
    "  const baseTemplate = getPackageJson({ name: template.name, includeStudio: false });\n"
    "  const studioTemplate = getPackageJson({ name: template.name, includeStudio: true });\n",
    "  const baseTemplate = getPackageJson({ name: template.name, includeStudio: false, targets });\n"
    "  const studioTemplate = getPackageJson({ name: template.name, includeStudio: true, targets });\n",
)
replace_once(
    path,
    "    storageProvider: 'supabase',\n  });\n  const supabaseStudioTemplate",
    "    storageProvider: 'supabase',\n    targets,\n  });\n  const supabaseStudioTemplate",
)
replace_once(
    path,
    "    storageProvider: 'supabase',\n  });\n  const supabaseDatabaseTemplate",
    "    storageProvider: 'supabase',\n    targets,\n  });\n  const supabaseDatabaseTemplate",
)
replace_once(
    path,
    "    databaseRuntimeProvider: 'supabase',\n  });\n",
    "    databaseRuntimeProvider: 'supabase',\n    targets,\n  });\n",
)
regex_once(
    path,
    r"function mergeScripts\([\s\S]*?\n}\n$",
    """function mergeScripts(
  existingScripts: PartialPackageScripts,
  templateScripts: PackageScripts,
): PackageScripts {
  const mergedScripts = {
    ...templateScripts,
    ...existingScripts,
  };

  for (const scriptName of REQUIRED_MANAGED_SCRIPT_NAMES) {
    mergedScripts[scriptName] = templateScripts[scriptName];
  }
  for (const scriptName of TARGET_SCRIPT_NAMES) {
    const targetScript = templateScripts[scriptName];
    if (targetScript === undefined) {
      delete mergedScripts[scriptName];
    } else {
      mergedScripts[scriptName] = targetScript;
    }
  }

  return mergedScripts;
}
""",
)

# Project creation persists target identity exactly once; regeneration consumes persisted targets.
path = 'src/host/orchestrator/projectManager.ts'
replace_once(
    path,
    "import { ProjectScaffolder } from './scaffolder';\n",
    "import { createDefaultAppDeployManifest } from './projectTargets';\n"
    "import { ProjectScaffolder } from './scaffolder';\n",
)
replace_once(
    path,
    "    const templateData = this.scaffolder.getTemplate(templateSelection);\n"
    "    const scaffoldManifest = applySystemTemplates(templateData);\n",
    "    const templateData = this.scaffolder.getTemplate(templateSelection);\n"
    "    const deploy = templateData.deploy ?? createDefaultAppDeployManifest(slug);\n"
    "    const scaffoldManifest = applySystemTemplates({ ...templateData, deploy });\n",
)
replace_once(
    path,
    "      splashScreen: scaffoldManifest.splashScreen ?? null,\n"
    "      zoraExtensions,\n"
    "    });\n",
    "      splashScreen: scaffoldManifest.splashScreen ?? null,\n"
    "      targets: deploy.targets,\n"
    "      zoraExtensions,\n"
    "    });\n",
)
replace_once(
    path,
    "      templateSelection.category,\n    );\n",
    "      templateSelection.category,\n      deploy,\n    );\n",
)
replace_once(
    path,
    "      splashScreen: manifest.splashScreen ?? null,\n    });\n",
    "      splashScreen: manifest.splashScreen ?? null,\n"
    "      targets: manifest.deploy?.targets,\n"
    "    });\n",
)

# Consume released owner packages.
replace_once('package.json', '"@ankhorage/contracts": "^7.6.0"', '"@ankhorage/contracts": "^7.7.0"')
replace_once('package.json', '"@ankhorage/infra": "^3.2.0"', '"@ankhorage/infra": "^3.3.0"')

# Preserve the newly persisted project target identity when replacing the OAuth smoke fixture manifest.
path = 'src/host/oauthFixtureConsumer.smoke.test.ts'
replace_once(
    path,
    "    const manifest = createOAuthFixtureManifest({\n",
    "    const createdManifest = await projectManager.getProjectManifest(created.id);\n"
    "    const manifest = createOAuthFixtureManifest({\n",
)
replace_once(
    path,
    "      overrides: {\n        metadata: {\n",
    "      overrides: {\n        deploy: createdManifest.deploy,\n        metadata: {\n",
)

# Replace the old slug-derived template assertion.
regex_once(
    'src/host/orchestrator/templates.test.ts',
    r"  it\('generates one deterministic native scheme for callback deep links',[\s\S]*?\n  \}\);\n\n  it\('uses the canonical Expo Router entry",
    """  it('uses canonical target identities for generated native configuration', () => {
    const appConfig = getAppConfigTs({
      name: 'OAuth App',
      slug: 'renamed-oauth-app',
      targets: {
        web: { enabled: true },
        android: {
          enabled: true,
          package: 'com.example.stable.android',
          scheme: 'stable-android',
        },
        ios: {
          enabled: true,
          bundleIdentifier: 'com.example.stable.ios',
          scheme: 'stable-ios',
        },
      },
    });

    expect(appConfig).toContain("package: 'com.example.stable.android'");
    expect(appConfig).toContain("bundleIdentifier: 'com.example.stable.ios'");
    expect(appConfig).toContain("scheme: 'stable-android'");
    expect(appConfig).toContain("scheme: 'stable-ios'");
    expect(appConfig).not.toContain('com.ankh.renamedoauthapp');
  });

  it('uses the canonical Expo Router entry""",
)

Path('src/host/orchestrator/projectTargets.ts').write_text("""import type { AppDeployManifest } from '@ankhorage/contracts/deploy';

const RESERVED_NATIVE_IDENTIFIER_SEGMENTS = new Set(
  [
    'abstract',
    'annotation',
    'as',
    'break',
    'byte',
    'case',
    'catch',
    'char',
    'class',
    'companion',
    'const',
    'continue',
    'data',
    'do',
    'double',
    'else',
    'enum',
    'extends',
    'false',
    'final',
    'finally',
    'float',
    'for',
    'fun',
    'if',
    'implements',
    'import',
    'in',
    'int',
    'interface',
    'internal',
    'is',
    'long',
    'native',
    'new',
    'null',
    'object',
    'open',
    'operator',
    'out',
    'override',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'sealed',
    'short',
    'static',
    'strictfp',
    'super',
    'suspend',
    'switch',
    'synchronized',
    'this',
    'throw',
    'throws',
    'transient',
    'true',
    'try',
    'typealias',
    'typeof',
    'val',
    'var',
    'void',
    'volatile',
    'when',
    'while',
  ].map((segment) => segment.toLowerCase()),
);

export function createDefaultAppDeployManifest(projectId: string): AppDeployManifest {
  const identifierSegment = createNativeIdentifierSegment(projectId);
  const applicationId = `com.ankh.${identifierSegment}`;
  const scheme = `ankh-${identifierSegment.replaceAll('_', '') || 'app'}`;

  return {
    targets: {
      web: { enabled: true },
      android: {
        enabled: true,
        package: applicationId,
        scheme,
      },
      ios: {
        enabled: true,
        bundleIdentifier: applicationId,
        scheme,
      },
    },
  };
}

function createNativeIdentifierSegment(projectId: string): string {
  const sanitized = projectId.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  const ensuredValue = sanitized.length > 0 ? sanitized : 'app';
  const leadingLetterSegment = /^[a-z]/u.test(ensuredValue) ? ensuredValue : `app${ensuredValue}`;

  return RESERVED_NATIVE_IDENTIFIER_SEGMENTS.has(leadingLetterSegment)
    ? `app${leadingLetterSegment}`
    : leadingLetterSegment;
}
""")

Path('src/host/orchestrator/appTargetGeneration.test.ts').write_text("""import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import { describe, expect, it } from 'bun:test';

import { createDefaultAppDeployManifest } from './projectTargets';
import { getAppConfigTs, getPackageJson } from './templates';

const WEB = { web: { enabled: true } } as const satisfies AppDeployTargets;
const ANDROID = {
  android: {
    enabled: true,
    package: 'com.example.android',
    scheme: 'example-android',
  },
} as const satisfies AppDeployTargets;
const IOS = {
  ios: {
    enabled: true,
    bundleIdentifier: 'com.example.ios',
    scheme: 'example-ios',
  },
} as const satisfies AppDeployTargets;

const COMBINATIONS = [
  ['web', WEB],
  ['android', ANDROID],
  ['ios', IOS],
  ['web+android', { ...WEB, ...ANDROID }],
  ['web+ios', { ...WEB, ...IOS }],
  ['android+ios', { ...ANDROID, ...IOS }],
  ['web+android+ios', { ...WEB, ...ANDROID, ...IOS }],
] as const satisfies readonly (readonly [string, AppDeployTargets])[];

describe('canonical app target generation', () => {
  it.each(COMBINATIONS)('emits only enabled target sections and scripts for %s', (_label, targets) => {
    const appConfig = getAppConfigTs({ name: 'Target App', slug: 'target-app', targets });
    const scripts = getPackageJson({ name: 'target-app', targets }).scripts as Readonly<
      Record<string, string>
    >;

    expect(appConfig.includes('  web: {')).toBe(targets.web?.enabled === true);
    expect(appConfig.includes('  android: {')).toBe(targets.android?.enabled === true);
    expect(appConfig.includes('  ios: {')).toBe(targets.ios?.enabled === true);
    expect('web' in scripts).toBe(targets.web?.enabled === true);
    expect('android' in scripts).toBe(targets.android?.enabled === true);
    expect('ios' in scripts).toBe(targets.ios?.enabled === true);
  });

  it('keeps generated native identity independent from the slug', () => {
    const appConfig = getAppConfigTs({
      name: 'Target App',
      slug: 'renamed-slug',
      targets: { ...ANDROID, ...IOS },
    });

    expect(appConfig).toContain("package: 'com.example.android'");
    expect(appConfig).toContain("scheme: 'example-android'");
    expect(appConfig).toContain("bundleIdentifier: 'com.example.ios'");
    expect(appConfig).toContain("scheme: 'example-ios'");
    expect(appConfig).not.toContain('ankh-renamedslug');
  });

  it('persists the historical target identity for new projects', () => {
    expect(createDefaultAppDeployManifest('oauth-fixture-consumer')).toEqual({
      targets: {
        web: { enabled: true },
        android: {
          enabled: true,
          package: 'com.ankh.oauthfixtureconsumer',
          scheme: 'ankh-oauthfixtureconsumer',
        },
        ios: {
          enabled: true,
          bundleIdentifier: 'com.ankh.oauthfixtureconsumer',
          scheme: 'ankh-oauthfixtureconsumer',
        },
      },
    });
  });

  it('does not invent a native scheme when the canonical target omits one', () => {
    const appConfig = getAppConfigTs({
      name: 'Legacy Native App',
      slug: 'legacy-native-app',
      targets: {
        android: { enabled: true, package: 'com.example.legacy' },
      },
    });

    expect(appConfig).toContain("package: 'com.example.legacy'");
    expect(appConfig).not.toContain('scheme:');
  });
});
""")

Path('docs/auth4-target-generation.md').write_text("""# Auth 4 canonical target generation

Studio generation consumes `AppManifest.deploy.targets` as the application platform identity source.

- New Studio projects preserve the historical Web + Android + iOS default by deriving identifiers once during project creation and persisting them into `deploy.targets`.
- Regeneration reads Android package, iOS bundle identifier, and native schemes only from the persisted target model; slug changes do not rename native identities.
- Disabled targets do not emit their Expo platform section or package script.
- Manifests predating `deploy.targets` use a migration-safe Web-only generation view and do not gain guessed native identities.
- Native targets without a canonical scheme do not receive a Studio-generated scheme.

Infra owns redirect allowlist derivation from the same target model; Studio does not duplicate redirect policy.
""")

Path('.changeset/auth4-canonical-target-generation.md').write_text("""---
'@ankhorage/studio': minor
---

Consume canonical app deployment targets when generating Expo platform configuration and scripts, persist stable native identities for new projects, and stop deriving native identity during regeneration.
""")
