import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const dependencyRules = [
  ['dependency-expo-sdk54', 'expo', /(?:^|\D)54\./u],
  ['dependency-react-19.1', 'react', /(?:^|\D)19\.1(?:\.|$)/u],
  ['dependency-react-dom-19.1', 'react-dom', /(?:^|\D)19\.1(?:\.|$)/u],
  ['dependency-react-native-0.81', 'react-native', /(?:^|\D)0\.81(?:\.|$)/u],
  ['dependency-expo-router-6', 'expo-router', /(?:^|\D)6\./u],
  ['dependency-reanimated-4.3', 'react-native-reanimated', /(?:^|\D)4\.3(?:\.|$)/u],
  ['dependency-worklets-0.8', 'react-native-worklets', /(?:^|\D)0\.8(?:\.|$)/u],
  ['dependency-camera-17', 'expo-camera', /(?:^|\D)17\./u],
  ['dependency-file-system-19', 'expo-file-system', /(?:^|\D)19\./u],
  ['dependency-updates-29', 'expo-updates', /(?:^|\D)29\./u],
  ['dependency-node-types-25', '@types/node', /(?:^|\D)25\./u],
];
const dependencyGroups = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const forbiddenDependencySpec = /^(?:file|link|workspace):|^latest$/u;
const literalRules = [
  ['sdk54-animation-compatibility', /EXPO_SDK_54_ANIMATION_COMPATIBILITY/gu],
  ['explicit-worklets-babel-plugin', /react-native-worklets\/plugin/gu],
  ['direct-react-navigation-import', /@react-navigation\//gu],
  ['legacy-vector-icons-package', /@expo\/vector-icons/gu],
  ['network-expo-cli-fallback', /bunx\s+expo(?:@latest)?/gu],
  ['worklets-bundle-mode', /worklets[^\n]{0,32}bundle[^\n]{0,16}mode/giu],
  ['router-babel-alias', /babel-plugin-module-resolver/gu],
  ['legacy-fast-resolver-override', /EXPO_USE_FAST_RESOLVER/gu],
  ['redundant-package-exports-override', /unstable_enablePackageExports/gu],
  ['redundant-metro-import-override', /experimentalImportSupport/gu],
];
const ignoredDirectoryNames = new Set([
  '.expo',
  '.git',
  'dist',
  'dist-android',
  'dist-ios',
  'dist-web',
  'node_modules',
]);
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.md',
  '.mjs',
  '.sh',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

export async function assertNoStaleExpo57StateAsync(options) {
  const findings = [];
  const roots = options.includePaths ?? ['.'];
  for (const includedPath of roots) {
    const absolutePath = path.join(options.root, includedPath);
    if (await pathExistsAsync(absolutePath)) {
      await scanPathAsync({ absolutePath, findings, options });
    }
  }

  if (options.mode === 'generated-app') {
    await inspectGeneratedProjectShapeAsync(options.root, findings);
  }

  const unexplained = [];
  for (const finding of findings) {
    const classification = options.allowedFindings?.find(
      (entry) =>
        entry.artifactId === finding.artifactId && entry.relativePath === finding.relativePath,
    );
    if (classification) {
      console.log(
        `INTENTIONAL CURRENT USE: ${finding.relativePath}:${finding.line} ${finding.artifactId} — ${classification.reason}`,
      );
    } else {
      unexplained.push(finding);
    }
  }

  if (unexplained.length > 0) {
    throw new Error(
      `Unexplained stale Expo platform state:\n${unexplained
        .map(
          (finding) =>
            `- ${finding.relativePath}:${finding.line} [${finding.artifactId}] ${finding.detail}`,
        )
        .join('\n')}`,
    );
  }

  console.log(`Zero-stale-state audit passed for ${options.root}.`);
}

function addFinding(findings, artifactId, relativePath, line, detail) {
  findings.push({ artifactId, relativePath, line, detail });
}

function inspectDependencies(packageJson, relativePath, findings) {
  for (const group of dependencyGroups) {
    const dependencies = packageJson[group];
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
    for (const [packageName, rawVersion] of Object.entries(dependencies)) {
      if (typeof rawVersion !== 'string') continue;
      if (forbiddenDependencySpec.test(rawVersion)) {
        addFinding(
          findings,
          'non-registry-dependency-spec',
          relativePath,
          1,
          `${group}.${packageName} uses ${rawVersion}`,
        );
      }
      if (packageName.startsWith('@react-navigation/')) {
        addFinding(
          findings,
          'direct-react-navigation-dependency',
          relativePath,
          1,
          `${group} declares ${packageName}`,
        );
      }
      if (packageName === '@expo/vector-icons') {
        addFinding(
          findings,
          'legacy-vector-icons-dependency',
          relativePath,
          1,
          `${group} declares ${packageName}`,
        );
      }
      if (packageName === 'babel-plugin-module-resolver') {
        addFinding(
          findings,
          'router-babel-alias-dependency',
          relativePath,
          1,
          `${group} declares ${packageName}`,
        );
      }
      for (const [artifactId, expectedName, versionPattern] of dependencyRules) {
        if (packageName === expectedName && versionPattern.test(rawVersion)) {
          addFinding(
            findings,
            artifactId,
            relativePath,
            1,
            `${group}.${packageName} uses ${rawVersion}`,
          );
        }
      }
    }
  }
}

async function inspectGeneratedProjectShapeAsync(root, findings) {
  for (const fileName of ['babel.config.js', 'index.js', 'metro.config.js']) {
    if (await pathExistsAsync(path.join(root, fileName))) {
      addFinding(
        findings,
        'generated-platform-wrapper',
        fileName,
        1,
        'generated Expo 57 apps must use canonical Expo defaults without a wrapper file',
      );
    }
  }
  for (const directoryName of ['android', 'ios']) {
    if (await pathExistsAsync(path.join(root, directoryName))) {
      addFinding(
        findings,
        'hand-maintained-native-project',
        directoryName,
        1,
        'fresh generated acceptance apps must derive native projects through clean CNG',
      );
    }
  }
}

function isIgnored(relativePath, options) {
  return (options.ignoredPaths ?? []).some(
    (ignoredPath) =>
      relativePath === ignoredPath || relativePath.startsWith(`${ignoredPath}${path.sep}`),
  );
}

function isTextFile(filePath) {
  const baseName = path.basename(filePath);
  return baseName === '.gitignore' || textExtensions.has(path.extname(baseName));
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

async function pathExistsAsync(target) {
  return (await stat(target).catch(() => null)) !== null;
}

async function scanFileAsync({ absolutePath, findings, options }) {
  const relativePath = path.relative(options.root, absolutePath) || '.';
  if (isIgnored(relativePath, options) || !isTextFile(absolutePath)) return;
  const source = await readFile(absolutePath, 'utf8');
  if (path.basename(absolutePath) === 'package.json') {
    const packageJson = JSON.parse(source);
    inspectDependencies(packageJson, relativePath, findings);
  }
  for (const [artifactId, pattern] of literalRules) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      addFinding(findings, artifactId, relativePath, lineNumberAt(source, match.index), match[0]);
    }
  }
}

async function scanPathAsync({ absolutePath, findings, options }) {
  const relativePath = path.relative(options.root, absolutePath) || '.';
  if (isIgnored(relativePath, options)) return;
  const fileStat = await lstat(absolutePath);
  if (fileStat.isSymbolicLink()) {
    addFinding(
      findings,
      'symlinked-active-state',
      relativePath,
      1,
      'active acceptance state must not reach another source tree through a symlink',
    );
    return;
  }
  if (fileStat.isFile()) {
    await scanFileAsync({ absolutePath, findings, options });
    return;
  }
  if (!fileStat.isDirectory() || ignoredDirectoryNames.has(path.basename(absolutePath))) return;
  const entries = await readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    await scanPathAsync({
      absolutePath: path.join(absolutePath, entry.name),
      findings,
      options,
    });
  }
}
