import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const tsconfig = await readFile(path.join(projectRoot, 'tsconfig.json'), 'utf8');

assertEqual(packageJson.main, `${EXPO_PLATFORM.navigation.expoRouter.name}/entry`, 'Router entry');
assertEqual(packageJson.engines?.node, EXPO_PLATFORM.tooling.node.version, 'Node engine');
assertEqual(packageJson.packageManager, 'bun@1.3.14', 'Bun toolchain');
assertEqual(packageJson.dependencies?.['@ankhorage/studio'], '^2.0.7', 'Studio release range');
assertEqual(
  packageJson.devDependencies?.['@ankhorage/expo-runtime'],
  '^3.0.6',
  'Expo Runtime release range',
);

for (const dependency of collectPlatformDependencies()) {
  assertEqual(
    packageJson.dependencies?.[dependency.name] ?? packageJson.devDependencies?.[dependency.name],
    dependency.version,
    dependency.name,
  );
}

if ('workspaces' in packageJson) fail('Studio app must not declare a workspace.');
for (const [name, version] of Object.entries({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
})) {
  if (typeof version !== 'string') fail(`${name} has a non-string dependency range.`);
  if (version === 'latest' || /^(?:file|link|workspace):/u.test(version)) {
    fail(`${name} uses forbidden standalone dependency range ${version}.`);
  }
}
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (typeof command !== 'string') fail(`${name} has a non-string script.`);
  if (command.includes('../..')) fail(`${name} reaches outside the app package root.`);
}
if (tsconfig.includes('../../') || tsconfig.includes('dist/root.d.ts')) {
  fail('TypeScript configuration reaches into the parent Studio checkout.');
}

console.log(
  `Studio consumer matches Expo SDK ${EXPO_PLATFORM.sdk}, ${EXPO_PLATFORM.architecture}, Node ${EXPO_PLATFORM.tooling.node.version}.`,
);

function assertEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} is ${String(actual)}; expected ${String(expected)}.`);
}

function collectPlatformDependencies() {
  return [
    ...Object.values(EXPO_PLATFORM.runtime),
    EXPO_PLATFORM.tooling.nodeTypes,
    EXPO_PLATFORM.tooling.typescript,
    EXPO_PLATFORM.tooling.expoDoctor,
    EXPO_PLATFORM.navigation.expoRouter,
    EXPO_PLATFORM.navigation.screens,
    EXPO_PLATFORM.navigation.safeArea,
    EXPO_PLATFORM.animation.gestureHandler,
    EXPO_PLATFORM.animation.reanimated,
    EXPO_PLATFORM.animation.worklets,
    EXPO_PLATFORM.packages.constants,
    EXPO_PLATFORM.packages.devClient,
    EXPO_PLATFORM.packages.linking,
    EXPO_PLATFORM.packages.splashScreen,
    EXPO_PLATFORM.packages.statusBar,
  ];
}

function fail(message) {
  throw new Error(message);
}
