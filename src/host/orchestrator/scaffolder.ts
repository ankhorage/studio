import type { AppCategory, AppManifest, SplashScreenSpec } from '@ankhorage/contracts';
import type { AppDeployManifest, AppDeployTargets } from '@ankhorage/contracts/deploy';
import type { ExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { pathExists } from '@ankhorage/utility/node/fs';
import { promises as fs } from 'fs';
import path from 'path';

import { applySystemTemplates } from '../manifestSystem';
import {
  collectZoraExtensionDependencies,
  mergeZoraExtensions,
  resolveZoraExtensionsFromDependencies,
  type ZoraExtensionDefinition,
} from '../zoraExtensions';
import { syncGeneratedAppFiles } from './generatedAppFiles';
import { createDefaultAppDeployManifest } from './projectTargets';
import {
  type GeneratedAuthProvider,
  type GeneratedStorageProvider,
  getAndroidRunTs,
  getAppConfigTs,
  getEasJson,
  getMetroConfigJs,
  getMetroEmptyModuleJs,
  getPackageJson,
  getTsConfigJson,
} from './templates';

interface ScaffoldProjectOptions {
  includeStudio?: boolean;
  authProvider?: GeneratedAuthProvider;
  storageProvider?: GeneratedStorageProvider;
  splashScreen?: SplashScreenSpec | null;
  zoraExtensions?: readonly ZoraExtensionDefinition[];
  runtimePlan?: ExpoRuntimePlan;
  targets?: AppDeployTargets;
}

interface SyncProjectScaffoldOptions extends Omit<ScaffoldProjectOptions, 'targets'> {
  targets: AppDeployTargets;
}

type PackageJsonShape = ReturnType<typeof getPackageJson>;
type ExtendedPackageJsonShape = Omit<PackageJsonShape, 'dependencies'> & {
  dependencies: Record<string, string>;
};
type PackageScripts = PackageJsonShape['scripts'];
type PartialPackageScripts = Partial<PackageScripts>;

const REQUIRED_MANAGED_SCRIPT_NAMES = [
  'lint',
  'lint:fix',
  'format',
  'format:check',
  'knip:check',
] as const;
const TARGET_SCRIPT_NAMES = ['android', 'ios', 'web'] as const;
const APP_PRETTIER_LOCAL_CONFIG = `module.exports = {
  overrides: [
    { files: ['ankh.config.json', 'eas.json', 'tsconfig.json'], options: { printWidth: 1 } },
    { files: 'infra/**/*.{yaml,yml}', options: { singleQuote: false } },
  ],
};
`;
const APP_KNIP_CONFIG = `import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  ignore: ['metro.empty-module.js', 'src/generated/appExtensionRegistry.ts'],
  ignoreBinaries: ['adb'],
  ignoreDependencies: [
    '@ankhorage/ankh',
    '@ankhorage/data-sources',
    '@ankhorage/navigator',
    '@ankhorage/supabase-storage',
    '@types/culori',
    'expo-updates',
  ],
  ignoreFiles: [
    '.prettierrc.js',
    'eslint.config.mjs',
    'eslint.local.config.mjs',
    'prettier.local.config.js',
  ],
});
`;
const APP_PRETTIERIGNORE_ENTRIES = ['/.ankh/', '/infra/'] as const;
const APP_GITIGNORE_ENTRIES = [
  'node_modules/',
  '.expo/',
  '/.ankh/',
  'dist/',
  'dist-*/',
  'android/',
  'ios/',
  '.env*',
  '.DS_Store',
] as const;

/***
 * Materialize and synchronize generated Expo project scaffold files, dependencies, tooling configuration, assets and target-specific scripts.
 * @todo Move project scaffold generation from host/orchestrator into the projects/templates generation domain; host should invoke it through an adapter boundary.
 */
export class ProjectScaffolder {
  /*** Bind scaffold generation to one Studio workspace root. */
  constructor(private readonly rootPath: string) {}

  /*** Create the initial generated project directory, package/tooling configuration, managed app files and default assets. */
  async scaffoldProject(
    projectPath: string,
    appName: string,
    slug: string,
    options: ScaffoldProjectOptions = {},
  ) {
    const {
      includeStudio = true,
      authProvider = null,
      storageProvider = null,
      splashScreen = null,
      zoraExtensions = [],
      runtimePlan,
      targets = createDefaultAppDeployManifest(slug).targets,
    } = options;
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src/app'), { recursive: true });

    await this.writePackageJson(
      projectPath,
      slug,
      includeStudio,
      authProvider,
      storageProvider,
      zoraExtensions,
      runtimePlan,
      targets,
    );
    await this.syncAndroidRunScript(projectPath, targets, slug, includeStudio);
    await this.writeAppConfig(projectPath, appName, slug, targets, splashScreen, runtimePlan);
    await this.writeEasConfig(projectPath);
    await this.writeMetroConfig(projectPath);
    await this.writeTsConfig(projectPath);
    await this.ensurePrettierLocalConfig(projectPath);
    await this.ensurePrettierIgnore(projectPath);
    await this.ensureKnipConfig(projectPath);
    await this.ensureAppGitIgnore(projectPath);
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan,
      zoraExtensions,
    });

    await this.copyDefaultAssets(projectPath);
  }

  /*** Reconcile an existing generated project's managed scaffold while preserving app-owned package metadata and extension dependencies. */
  async syncProjectScaffold(
    projectPath: string,
    appName: string,
    slug: string,
    options: SyncProjectScaffoldOptions,
  ) {
    const {
      includeStudio = true,
      authProvider = null,
      storageProvider = null,
      splashScreen = null,
      runtimePlan,
      targets,
    } = options;
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src/app'), { recursive: true });

    const packageJsonPath = path.join(projectPath, 'package.json');
    const existingPackageJson = await this.readPackageJson(packageJsonPath);
    const existingZoraExtensions = resolveZoraExtensionsFromDependencies(
      existingPackageJson?.dependencies ?? {},
    );
    const zoraExtensions = mergeZoraExtensions(
      options.zoraExtensions ?? [],
      existingZoraExtensions,
    );
    const templatePackageJson = withZoraExtensionDependencies(
      getPackageJson({
        name: existingPackageJson?.name ?? slug,
        includeStudio,
        authProvider,
        storageProvider,
        runtimePlan,
        targets,
      }),
      zoraExtensions,
    );

    const nextPackageJson = mergePackageJson(existingPackageJson, templatePackageJson, targets);

    await fs.writeFile(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf8');
    await this.syncAndroidRunScript(projectPath, targets, slug, includeStudio);
    await this.writeAppConfig(projectPath, appName, slug, targets, splashScreen, runtimePlan);
    await this.writeEasConfig(projectPath);
    await this.writeMetroConfig(projectPath);
    await this.writeTsConfig(projectPath);
    await this.ensurePrettierLocalConfig(projectPath);
    await this.ensurePrettierIgnore(projectPath);
    await this.ensureKnipConfig(projectPath);
    await this.ensureAppGitIgnore(projectPath);
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan,
      zoraExtensions,
    });
  }

  /*** Finalize and persist the canonical project manifest with project-owned identity/category/timestamps and system templates applied. */
  async finalizeManifest(
    projectPath: string,
    templateData: AppManifest,
    appName: string,
    slug: string,
    category: AppCategory,
    deploy: AppDeployManifest,
  ) {
    const now = new Date().toISOString();
    const manifestWithCategory: AppManifest = {
      ...templateData,
      deploy,
      metadata: {
        ...templateData.metadata,
        name: appName,
        slug,
        category,
        created: now,
        updated: now,
      },
    };
    const manifest: AppManifest = applySystemTemplates(manifestWithCategory);

    await fs.writeFile(
      path.join(projectPath, 'ankh.config.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    return manifest;
  }

  /*** Write the generated Expo app.config.ts for current identity, deploy targets, splash and runtime plan. */
  private async writeAppConfig(
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

  /*** Write the generated app-owned EAS build and submit profiles. */
  private async writeEasConfig(dir: string) {
    await fs.writeFile(path.join(dir, 'eas.json'), getEasJson(), 'utf8');
  }

  /*** Write the minimal Expo 57 Metro resolver boundary that prevents ancestor package fallback. */
  private async writeMetroConfig(dir: string) {
    await Promise.all([
      fs.writeFile(path.join(dir, 'metro.config.js'), getMetroConfigJs(), 'utf8'),
      fs.writeFile(path.join(dir, 'metro.empty-module.js'), getMetroEmptyModuleJs(), 'utf8'),
    ]);
  }

  /*** Create or remove the managed Android run script according to the current Android deploy target. */
  private async syncAndroidRunScript(
    dir: string,
    targets: AppDeployTargets,
    projectId: string,
    includeStudio: boolean,
  ) {
    const scriptPath = path.join(dir, 'scripts', 'ankh-android.ts');
    if (!targets.android?.enabled) {
      await fs.rm(scriptPath, { force: true });
      return;
    }

    await fs.mkdir(path.dirname(scriptPath), { recursive: true });
    await fs.writeFile(scriptPath, getAndroidRunTs({ projectId, includeStudio }), 'utf8');
  }

  /*** Write the generated package.json with canonical owner dependencies plus selected ZORA extension dependencies. */
  private async writePackageJson(
    dir: string,
    slug: string,
    includeStudio: boolean,
    authProvider: GeneratedAuthProvider,
    storageProvider: GeneratedStorageProvider,
    zoraExtensions: readonly ZoraExtensionDefinition[],
    runtimePlan: ExpoRuntimePlan | undefined,
    targets: AppDeployTargets,
  ) {
    const packageJson = withZoraExtensionDependencies(
      getPackageJson({
        name: slug,
        includeStudio,
        authProvider,
        storageProvider,
        runtimePlan,
        targets,
      }),
      zoraExtensions,
    );
    await fs.writeFile(
      path.join(dir, 'package.json'),
      `${JSON.stringify(packageJson, null, 2)}\n`,
      'utf8',
    );
  }

  /*** Read the existing generated package manifest when present so synchronization can preserve app-owned metadata/dependencies. */
  private async readPackageJson(packageJsonPath: string): Promise<ExtendedPackageJsonShape | null> {
    if (!(await pathExists(packageJsonPath))) {
      return null;
    }

    const content = await fs.readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as ExtendedPackageJsonShape;
    return {
      ...parsed,
      dependencies: parsed.dependencies,
    };
  }

  /*** Write the generated TypeScript configuration. */
  private async writeTsConfig(dir: string) {
    await fs.writeFile(path.join(dir, 'tsconfig.json'), getTsConfigJson(), 'utf8');
  }

  /*** Seed app-specific Prettier overrides once while leaving the canonical wrapper to Devtools. */
  private async ensurePrettierLocalConfig(dir: string) {
    const configPath = path.join(dir, 'prettier.local.config.js');
    if (await pathExists(configPath)) return;
    await fs.writeFile(configPath, APP_PRETTIER_LOCAL_CONFIG, 'utf8');
  }

  /*** Ignore machine-managed state and generated infrastructure in app-owned formatting checks. */
  private async ensurePrettierIgnore(dir: string) {
    const ignorePath = path.join(dir, '.prettierignore');
    const existing = (await pathExists(ignorePath)) ? await fs.readFile(ignorePath, 'utf8') : '';
    const lines = existing.split(/\r?\n/gu);
    const missingEntries = APP_PRETTIERIGNORE_ENTRIES.filter((entry) => !lines.includes(entry));
    if (missingEntries.length === 0) return;
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await fs.writeFile(ignorePath, `${existing}${separator}${missingEntries.join('\n')}\n`, 'utf8');
  }

  /*** Seed the standalone app's Devtools-backed Knip scope once without modeling parent/sibling workspaces. */
  private async ensureKnipConfig(dir: string) {
    const configPath = path.join(dir, 'knip.config.ts');
    if (await pathExists(configPath)) return;
    await fs.writeFile(configPath, APP_KNIP_CONFIG, 'utf8');
  }

  /*** Ensure every generated app owns complete transient, build, secret, and editor ignore rules. */
  async ensureAppGitIgnore(dir: string) {
    const gitIgnorePath = path.join(dir, '.gitignore');
    const existing = (await pathExists(gitIgnorePath))
      ? await fs.readFile(gitIgnorePath, 'utf8')
      : '';
    const lines = existing.split(/\r?\n/gu);
    const missingEntries = APP_GITIGNORE_ENTRIES.filter((entry) => !lines.includes(entry));
    if (missingEntries.length === 0) return;
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await fs.writeFile(
      gitIgnorePath,
      `${existing}${separator}${missingEntries.join('\n')}\n`,
      'utf8',
    );
  }

  /*** Populate generated project icon/splash/favicon assets from repository defaults or deterministic 1x1 PNG fallbacks. */
  private async copyDefaultAssets(targetProjectPath: string) {
    const templateAssetsPath = path.join(this.rootPath, 'packages/cli/templates/assets');
    const targetAssetsPath = path.join(targetProjectPath, 'assets');
    const splashAssetsPath = path.join(targetAssetsPath, 'splash');
    const assets = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
    const splashAssets = ['icon.png', 'icon-dark.png'];

    await fs.mkdir(targetAssetsPath, { recursive: true });
    await fs.mkdir(splashAssetsPath, { recursive: true });

    const templateExists = await pathExists(templateAssetsPath);
    if (!templateExists) {
      const png1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      );
      for (const f of assets) {
        await fs.writeFile(path.join(targetAssetsPath, f), png1x1);
      }
      for (const f of splashAssets) {
        await fs.writeFile(path.join(splashAssetsPath, f), png1x1);
      }
      return;
    }

    for (const asset of assets) {
      const src = path.join(templateAssetsPath, asset);
      const dest = path.join(targetProjectPath, 'assets', asset);
      if (await pathExists(src)) {
        await fs.copyFile(src, dest);
      }
    }

    for (const asset of splashAssets) {
      const src = path.join(templateAssetsPath, asset);
      const defaultSplashSrc = path.join(templateAssetsPath, 'splash.png');
      const dest = path.join(splashAssetsPath, asset);
      if (await pathExists(src)) {
        await fs.copyFile(src, dest);
      } else if (await pathExists(defaultSplashSrc)) {
        await fs.copyFile(defaultSplashSrc, dest);
      }
    }
  }
}

/*** Add dependency requirements from selected ZORA extensions to a generated package manifest. */
function withZoraExtensionDependencies(
  packageJson: PackageJsonShape,
  zoraExtensions: readonly ZoraExtensionDefinition[],
): ExtendedPackageJsonShape {
  return {
    ...packageJson,
    dependencies: {
      ...packageJson.dependencies,
      ...collectZoraExtensionDependencies(zoraExtensions),
    },
  };
}

/*** Reconcile Studio-managed package dependencies/devDependencies/scripts while preserving unrelated app-owned package metadata. */
function mergePackageJson(
  existing: ExtendedPackageJsonShape | null,
  template: ExtendedPackageJsonShape,
  targets: AppDeployTargets,
) {
  const baseTemplate = getPackageJson({ name: template.name, includeStudio: false, targets });
  const studioTemplate = getPackageJson({ name: template.name, includeStudio: true, targets });
  const supabaseBaseTemplate = getPackageJson({
    name: template.name,
    includeStudio: false,
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets,
  });
  const supabaseStudioTemplate = getPackageJson({
    name: template.name,
    includeStudio: true,
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets,
  });

  const managedDependencies = new Set([
    ...Object.keys(baseTemplate.dependencies),
    ...Object.keys(studioTemplate.dependencies),
    ...Object.keys(supabaseBaseTemplate.dependencies),
    ...Object.keys(supabaseStudioTemplate.dependencies),
    ...Object.keys(template.dependencies),
  ]);
  const managedDevDependencies = new Set([
    ...Object.keys(baseTemplate.devDependencies),
    ...Object.keys(studioTemplate.devDependencies),
  ]);

  const mergedDependencies: Record<string, string> = {
    ...(existing?.dependencies ?? {}),
  };
  for (const dependencyName of managedDependencies) {
    Reflect.deleteProperty(mergedDependencies, dependencyName);
  }
  Object.assign(mergedDependencies, template.dependencies);

  const mergedDevDependencies: Record<string, string> = {
    ...(existing?.devDependencies ?? {}),
  };
  for (const dependencyName of managedDevDependencies) {
    Reflect.deleteProperty(mergedDevDependencies, dependencyName);
  }
  Object.assign(mergedDevDependencies, template.devDependencies);

  return {
    ...(existing ?? {}),
    ...template,
    name: existing?.name ?? template.name,
    scripts: mergeScripts(existing?.scripts ?? {}, template.scripts),
    dependencies: mergedDependencies,
    devDependencies: mergedDevDependencies,
  };
}

/*** Merge app-owned scripts with generated template scripts while force-owning canonical quality scripts and current platform target scripts. */
function mergeScripts(
  existingScripts: PartialPackageScripts,
  templateScripts: PackageScripts,
): PackageScripts {
  const mergedScripts = {
    ...templateScripts,
    ...existingScripts,
  };

  for (const scriptName of REQUIRED_MANAGED_SCRIPT_NAMES) {
    const requiredScript = findScript(templateScripts, scriptName);
    if (requiredScript !== undefined)
      Object.assign(mergedScripts, { [scriptName]: requiredScript });
  }
  for (const scriptName of TARGET_SCRIPT_NAMES) {
    const targetScript = findScript(templateScripts, scriptName);
    if (targetScript === undefined) {
      Reflect.deleteProperty(mergedScripts, scriptName);
    } else {
      Object.assign(mergedScripts, { [scriptName]: targetScript });
    }
  }

  return mergedScripts;
}

/***
 * Find one named package script in a partial scripts record.
 * @utility @ankhorage/utility/package
 */
function findScript(scripts: PartialPackageScripts, scriptName: string): string | undefined {
  return Object.entries(scripts).find(([candidate]) => candidate === scriptName)?.[1];
}
