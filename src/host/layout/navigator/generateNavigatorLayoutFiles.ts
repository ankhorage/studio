import path from 'node:path';

import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import type {
  NavigatorGeneratedFile,
  NavigatorGenerationBindings,
  NavigatorNode,
  NavigatorRuntimePlatform,
} from '@ankhorage/contracts/navigator';
import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { createNavigatorPlan, generateNavigator } from '@ankhorage/navigator';
import { parseSemanticVersion } from '@ankhorage/utility/semver';

import { projectGeneratedRoute } from './projectGeneratedRoute';

export interface NavigatorOwnedLayoutFile {
  path: string;
  content: string;
}

interface GenerateNavigatorLayoutFilesInput {
  navigator: NavigatorNode;
  rootDirectory: string;
  targets: AppDeployTargets;
  bindings: NavigatorGenerationBindings;
  externalHeaderVisible?: boolean;
}

/*** Generate Navigator-owned layouts for enabled targets while leaving root-shell and screen ownership in Studio. */
export function generateNavigatorLayoutFiles(
  input: GenerateNavigatorLayoutFilesInput,
): NavigatorOwnedLayoutFile[] {
  const platforms = enabledPlatforms(input.targets);
  const generatedByPlatform = platforms.map((platform) => ({
    platform,
    files: generatePlatformLayouts(input, platform),
  }));
  const [fallback, ...platformOverrides] = generatedByPlatform;
  if (!fallback)
    throw new Error('Navigator generation requires at least one enabled deploy target.');

  const fallbackByPath = new Map(fallback.files.map((file) => [file.path, file.contents]));
  const output = fallback.files.map((file) => ({ path: file.path, content: file.contents }));
  for (const generated of platformOverrides) {
    for (const file of generated.files) {
      const fallbackContent = fallbackByPath.get(file.path);
      if (fallbackContent === undefined) {
        throw new Error(
          `Navigator produced inconsistent layout path ${JSON.stringify(file.path)}.`,
        );
      }
      if (file.contents === fallbackContent) continue;
      output.push({ path: platformPath(file.path, generated.platform), content: file.contents });
    }
  }

  return relocateNavigatorLayoutFiles(output, input.navigator, input.rootDirectory).sort(
    (left, right) => left.path.localeCompare(right.path),
  );
}

/*** Move Navigator's name-based nested layouts to the shared Expo Router module projection. */
function relocateNavigatorLayoutFiles(
  files: NavigatorOwnedLayoutFile[],
  navigator: NavigatorNode,
  rootDirectory: string,
): NavigatorOwnedLayoutFile[] {
  const directories = new Map<string, string>();
  collectNavigatorLayoutDirectories(navigator, rootDirectory, rootDirectory, '/', directories);
  return files.map((file) => {
    const directory = directories.get(path.posix.dirname(file.path));
    return directory
      ? { ...file, path: path.posix.join(directory, path.posix.basename(file.path)) }
      : file;
  });
}

/*** Map each owner-generated nested layout directory from Navigator names to Studio's canonical route modules. */
function collectNavigatorLayoutDirectories(
  navigator: NavigatorNode,
  sourceDirectory: string,
  destinationDirectory: string,
  parentPublicPath: string,
  directories: Map<string, string>,
): void {
  directories.set(sourceDirectory, destinationDirectory);
  for (const route of navigator.routes) {
    if (!route.navigator) continue;
    const projection = projectGeneratedRoute({
      parentModulePath: destinationDirectory,
      parentPublicPath,
      route,
    });
    collectNavigatorLayoutDirectories(
      route.navigator,
      path.posix.join(sourceDirectory, route.name),
      projection.modulePath,
      projection.publicPath,
      directories,
    );
  }
}

/*** Resolve enabled targets with Web first so its source remains the universal fallback file. */
function enabledPlatforms(targets: AppDeployTargets): NavigatorRuntimePlatform[] {
  return (['web', 'ios', 'android'] as const).filter((platform) =>
    isPlatformEnabled(targets, platform),
  );
}

/*** Read one deploy target without dynamic object injection. */
function isPlatformEnabled(targets: AppDeployTargets, platform: NavigatorRuntimePlatform): boolean {
  switch (platform) {
    case 'web':
      return targets.web?.enabled === true;
    case 'ios':
      return targets.ios?.enabled === true;
    case 'android':
      return targets.android?.enabled === true;
  }
}

/*** Plan and generate one platform without passing any AppManifest state to Navigator. */
function generatePlatformLayouts(
  input: GenerateNavigatorLayoutFilesInput,
  platform: NavigatorRuntimePlatform,
): readonly NavigatorGeneratedFile[] {
  const navigator = input.externalHeaderVisible
    ? withExternalHeaderOwnership(input.navigator)
    : input.navigator;
  const plan = createNavigatorPlan(withGeneratedRoutePaths(navigator, input.rootDirectory), {
    platform,
    expoRouterVersion: resolveExactVersion(EXPO_PLATFORM.navigation.expoRouter.version),
  });
  const result = generateNavigator(plan, input.bindings, {
    rootDirectory: input.rootDirectory,
    includeScreenFiles: false,
  });
  if (
    result.support === 'unsupported' ||
    result.diagnostics.some(({ severity }) => severity === 'error')
  ) {
    const diagnostics = result.diagnostics
      .filter(({ severity }) => severity === 'error')
      .map(({ code, path }) => `${code} at ${path}`)
      .join(', ');
    throw new Error(
      `Navigator manifest is unsupported for ${platform}: ${diagnostics || 'adapter unavailable'}.`,
    );
  }
  return result.files;
}

/*** Suppress generated Stack headers when the integrating app shell declares its own visible header. */
function withExternalHeaderOwnership(navigator: NavigatorNode): NavigatorNode {
  const routes = navigator.routes.map((route) => ({
    ...route,
    ...(navigator.type === 'stack'
      ? {
          stackOptions: {
            ...route.stackOptions,
            headerShown: false,
          },
        }
      : {}),
    ...(route.navigator ? { navigator: withExternalHeaderOwnership(route.navigator) } : {}),
  }));

  if (navigator.type !== 'stack') return { ...navigator, routes };
  if (navigator.implementation === 'javascript') {
    return {
      ...navigator,
      options: { ...navigator.options, headerShown: false },
      routes,
    };
  }
  if (navigator.implementation === 'experimental') {
    return {
      ...navigator,
      options: { ...navigator.options, headerShown: false },
      routes,
    };
  }

  return {
    ...navigator,
    options: { ...navigator.options, headerShown: false },
    routes,
  };
}

/*** Project Studio-owned routes through the shared module, URL, and Navigator path policy. */
function withGeneratedRoutePaths(
  navigator: NavigatorNode,
  parentModulePath: string,
  parentPublicPath = '/',
): NavigatorNode {
  const projectedRoutes = navigator.routes.flatMap((route) => {
    const projection = projectGeneratedRoute({
      parentModulePath,
      parentPublicPath,
      route,
    });
    const relativeModulePath = path.posix.relative(parentModulePath, projection.modulePath);
    if (relativeModulePath.startsWith('../')) return [];
    const navigatorName =
      route.navigator && /^\(.*\)$/u.test(route.name)
        ? route.name
        : path.posix.basename(projection.modulePath);
    return [
      {
        originalName: route.name,
        route: {
          ...route,
          name: navigatorName,
          path: projection.navigatorPath,
          ...(route.navigator
            ? {
                navigator: withGeneratedRoutePaths(
                  route.navigator,
                  projection.modulePath,
                  projection.publicPath,
                ),
              }
            : {}),
        },
      },
    ];
  });

  return {
    ...navigator,
    initialRouteName: projectedRoutes.find(
      (projected) => projected.originalName === navigator.initialRouteName,
    )?.route.name,
    routes: projectedRoutes.map((projected) => projected.route),
  };
}

/*** Read the concrete semantic version from Expo Runtime's package range. */
function resolveExactVersion(versionRange: string): string {
  const normalized = versionRange.startsWith('>=')
    ? versionRange.slice(2)
    : versionRange.startsWith('^') || versionRange.startsWith('~')
      ? versionRange.slice(1)
      : versionRange;
  const version = parseSemanticVersion(normalized);
  if (!version)
    throw new Error(`Expo Router range ${JSON.stringify(versionRange)} has no version.`);
  return `${version.major}.${version.minor}.${version.patch}`;
}

/*** Add an Expo platform suffix to a generated TypeScript layout path. */
function platformPath(filePath: string, platform: NavigatorRuntimePlatform): string {
  if (!filePath.endsWith('.tsx')) {
    throw new Error(`Navigator emitted a non-TSX layout path ${JSON.stringify(filePath)}.`);
  }
  return `${filePath.slice(0, -4)}.${platform}.tsx`;
}
