import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ProjectManager } from '../src/host/orchestrator/projectManager';
import { getProjectTemplateSource } from '../src/host/templates';
import { resolveAppOwnedExpoCliAsync } from '../src/host/smoke/resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from '../src/host/smoke/runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 900_000;
const RELEASE_BUILD_TIMEOUT_MS = 1_800_000;
const EXPECTED_SPLASH_SOURCE = 'assets/authoring/sharkprey-logo/sharkprey-logo.png';
const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'sharkprey-native-release-'));

try {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/sharkprey-native-release-evidence',
        packageManager: 'bun@1.4.2',
        private: true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const projectManager = new ProjectManager(workspaceRoot);
  const source = await getProjectTemplateSource({
    category: 'education_learning',
    slug: 'sharkprey',
  });
  const created = await projectManager.createProject('SharkPrey Native Release', source, undefined, {
    includeStudio: false,
  });
  const appRoot = created.path;
  const appConfig = await readFile(path.join(appRoot, 'app.config.ts'), 'utf8');
  const expectedExpoPath = `./${EXPECTED_SPLASH_SOURCE}`;

  if (!appConfig.includes(`image: '${expectedExpoPath}'`)) {
    throw new Error(`Generated app config does not reference ${expectedExpoPath}.`);
  }
  const sourceStat = await stat(path.join(appRoot, EXPECTED_SPLASH_SOURCE));
  if (!sourceStat.isFile() || sourceStat.size === 0) {
    throw new Error('Materialized SharkPrey splash source is missing or empty.');
  }

  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: appRoot,
    label: 'Install generated SharkPrey app',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });

  const expoCli = await resolveAppOwnedExpoCliAsync(appRoot);
  await runAcceptanceCommandAsync({
    args: ['prebuild', '--platform', 'android', '--clean', '--no-install'],
    command: expoCli,
    cwd: appRoot,
    env: {
      CI: '1',
      NODE_ENV: 'production',
      __UNSAFE_EXPO_HOME_DIRECTORY: path.join(appRoot, '.ankh', 'expo-home'),
    },
    label: 'Generate Android native project',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });

  const resourcesRoot = path.join(appRoot, 'android', 'app', 'src', 'main', 'res');
  const resourceFiles = await collectFilesAsync(resourcesRoot);
  const splashLogo = resourceFiles.find((filePath) =>
    path.basename(filePath).startsWith('splashscreen_logo'),
  );
  if (!splashLogo) {
    throw new Error('Android prebuild did not generate a native splash logo resource.');
  }
  const splashLogoStat = await stat(splashLogo);
  if (!splashLogoStat.isFile() || splashLogoStat.size === 0) {
    throw new Error('Generated Android splash logo resource is empty.');
  }

  const stylesPath = resourceFiles.find(
    (filePath) => path.basename(filePath) === 'styles.xml' && filePath.includes(`${path.sep}values`),
  );
  if (!stylesPath) throw new Error('Android prebuild did not generate values/styles.xml.');
  const styles = await readFile(stylesPath, 'utf8');
  for (const expected of ['Theme.App.SplashScreen', 'splashscreen_logo']) {
    if (!styles.includes(expected)) {
      throw new Error(`Android native splash styles are missing ${expected}.`);
    }
  }

  const androidRoot = path.join(appRoot, 'android');
  await runAcceptanceCommandAsync({
    args: ['assembleRelease', '--stacktrace'],
    command: path.join(androidRoot, 'gradlew'),
    cwd: androidRoot,
    env: { CI: '1', NODE_ENV: 'production' },
    label: 'Compile Android release variant',
    timeoutMs: RELEASE_BUILD_TIMEOUT_MS,
  });

  const releaseOutputRoot = path.join(androidRoot, 'app', 'build', 'outputs', 'apk', 'release');
  const releaseFiles = await collectFilesAsync(releaseOutputRoot);
  const releaseApk = releaseFiles.find((filePath) => filePath.endsWith('.apk'));
  if (!releaseApk) throw new Error('Android release build did not produce an APK.');
  const apkStat = await stat(releaseApk);
  if (!apkStat.isFile() || apkStat.size === 0) {
    throw new Error('Android release APK is empty.');
  }

  console.log(
    JSON.stringify(
      {
        appConfigSplashPath: expectedExpoPath,
        materializedSplashBytes: sourceStat.size,
        nativeSplashResource: path.relative(appRoot, splashLogo),
        nativeSplashResourceBytes: splashLogoStat.size,
        releaseApk: path.relative(appRoot, releaseApk),
        releaseApkBytes: apkStat.size,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(workspaceRoot, { force: true, recursive: true });
}

async function collectFilesAsync(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesAsync(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}
