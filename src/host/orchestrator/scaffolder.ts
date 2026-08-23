import type { AppCategory, AppManifest, SplashScreenSpec } from '@ankhorage/contracts';
import type { AppDeployManifest, AppDeployTargets } from '@ankhorage/contracts/deploy';
import type { ExpoRuntimePlan } from '@ankhorage/expo-runtime';
import { promises as fs } from 'fs';
import path from 'path';

import { applySystemTemplates } from '../manifestSystem';
import { getProjectTemplate, type ProjectTemplateSelection } from '../templateRegistry';
import {
  collectZoraExtensionDependencies,
  mergeZoraExtensions,
  resolveZoraExtensionsFromDependencies,
  type ZoraExtensionDefinition,
} from '../zoraExtensions';
import { syncGeneratedAppFiles } from './generatedAppFiles';
import {
  type GeneratedAuthProvider,
  type GeneratedStorageProvider,
  getAndroidRunTs,
  getAppConfigTs,
  getEslintConfigMjs,
  getPackageJson,
  getPrettierRcJs,
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

type PackageJsonShape = ReturnType<typeof getPackageJson>;
type ExtendedPackageJsonShape = Omit<PackageJsonShape, 'dependencies'> & {
  dependencies: Record<string, string>;
};
type PackageScripts = PackageJsonShape['scripts'];
type PartialPackageScripts = Partial<PackageScripts>;

const REQUIRED_MANAGED_SCRIPT_NAMES = ['lint', 'lint:fix', 'format', 'format:check'] as const;
const TARGET_SCRIPT_NAMES = ['android', 'ios', 'web'] as const;
const LEGACY_WEB_ONLY_TARGETS: AppDeployTargets = { web: { enabled: true } };
const LEGACY_MANAGED_DEV_DEPENDENCIES = ['eslint', 'prettier'] as const;

export class ProjectScaffolder {
  constructor(private readonly rootPath: string) {}

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
      targets = LEGACY_WEB_ONLY_TARGETS,
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
    await this.writeTsConfig(projectPath);
    await this.writeEslintConfig(projectPath);
    await this.writePrettierConfig(projectPath);
    await this.removeGeneratedExpoOverrides(projectPath);
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan,
      zoraExtensions,
    });

    await this.copyDefaultAssets(projectPath);
  }

  async syncProjectScaffold(
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
      runtimePlan,
      targets = LEGACY_WEB_ONLY_TARGETS,
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

    await fs.writeFile(packageJsonPath, JSON.stringify(nextPackageJson, null, 2), 'utf8');
    await this.syncAndroidRunScript(projectPath, targets, slug, includeStudio);
    await this.writeAppConfig(projectPath, appName, slug, targets, splashScreen, runtimePlan);
    await this.writeTsConfig(projectPath);
    await this.writeEslintConfig(projectPath);
    await this.writePrettierConfig(projectPath);
    await this.removeGeneratedExpoOverrides(projectPath);
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan,
      zoraExtensions,
    });
  }

  getTemplate(selection: ProjectTemplateSelection): AppManifest {
    return getProjectTemplate(selection);
  }

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
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    return manifest;
  }

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

  private async removeGeneratedExpoOverrides(dir: string) {
    await Promise.all(
      ['babel.config.js', 'index.js', 'metro.config.js'].map((fileName) =>
        fs.rm(path.join(dir, fileName), { force: true }),
      ),
    );
  }

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
      JSON.stringify(packageJson, null, 2),
      'utf8',
    );
  }

  private async readPackageJson(packageJsonPath: string): Promise<ExtendedPackageJsonShape | null> {
    if (!(await exists(packageJsonPath))) {
      return null;
    }

    const content = await fs.readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as ExtendedPackageJsonShape;
    return {
      ...parsed,
      dependencies: parsed.dependencies,
    };
  }

  private async writeTsConfig(dir: string) {
    await fs.writeFile(path.join(dir, 'tsconfig.json'), getTsConfigJson(), 'utf8');
  }

  private async writeEslintConfig(dir: string) {
    await fs.writeFile(path.join(dir, 'eslint.config.mjs'), getEslintConfigMjs(), 'utf8');
  }

  private async writePrettierConfig(dir: string) {
    await fs.writeFile(path.join(dir, '.prettierrc.js'), getPrettierRcJs(), 'utf8');
  }

  private async copyDefaultAssets(targetProjectPath: string) {
    const templateAssetsPath = path.join(this.rootPath, 'packages/cli/templates/assets');
    const targetAssetsPath = path.join(targetProjectPath, 'assets');
    const splashAssetsPath = path.join(targetAssetsPath, 'splash');
    const assets = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
    const splashAssets = ['icon.png', 'icon-dark.png'];

    await fs.mkdir(targetAssetsPath, { recursive: true });
    await fs.mkdir(splashAssetsPath, { recursive: true });

    const templateExists = await exists(templateAssetsPath);
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
      if (await exists(src)) {
        await fs.copyFile(src, dest);
      }
    }

    for (const asset of splashAssets) {
      const src = path.join(templateAssetsPath, asset);
      const fallbackSrc = path.join(templateAssetsPath, 'splash.png');
      const dest = path.join(splashAssetsPath, asset);
      if (await exists(src)) {
        await fs.copyFile(src, dest);
      } else if (await exists(fallbackSrc)) {
        await fs.copyFile(fallbackSrc, dest);
      }
    }
  }
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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
    '@expo/metro-config',
    ...LEGACY_MANAGED_DEV_DEPENDENCIES,
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

function findScript(scripts: PartialPackageScripts, scriptName: string): string | undefined {
  return Object.entries(scripts).find(([candidate]) => candidate === scriptName)?.[1];
}
