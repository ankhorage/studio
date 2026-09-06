import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import type { NavigatorNode } from '@ankhorage/contracts/navigator';
import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import {
  createNavigatorPlan,
  generateNavigatorFiles,
  type NavigatorGeneratedFile,
  type NavigatorGenerationBindings,
  type NavigatorRuntimePlatform,
} from '@ankhorage/navigator';

export interface NavigatorOwnedLayoutFile {
  path: string;
  content: string;
}

interface GenerateNavigatorLayoutFilesInput {
  navigator: NavigatorNode;
  rootDirectory: string;
  targets: AppDeployTargets;
  bindings: NavigatorGenerationBindings;
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

  return output.sort((left, right) => left.path.localeCompare(right.path));
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
  const plan = createNavigatorPlan(withGeneratedRoutePaths(input.navigator), {
    platform,
    expoRouterVersion: resolveExactVersion(EXPO_PLATFORM.navigation.expoRouter.version),
  });
  if (!plan.supported) {
    const diagnostics = plan.diagnostics
      .filter(({ severity }) => severity === 'error')
      .map(({ code, path }) => `${code} at ${path}`)
      .join(', ');
    throw new Error(
      `Navigator manifest is unsupported for ${platform}: ${diagnostics || 'adapter unavailable'}.`,
    );
  }
  return generateNavigatorFiles(plan, input.bindings, {
    rootDirectory: input.rootDirectory,
    includeScreenFiles: false,
  });
}

/*** Project Studio-owned public route paths into the navigator slice required by headless tabs. */
function withGeneratedRoutePaths(navigator: NavigatorNode, parentPath = '/'): NavigatorNode {
  return {
    ...navigator,
    routes: navigator.routes.map((route) => {
      const publicPath = resolvePublicRoutePath(parentPath, route.name, route.path);
      return {
        ...route,
        path: publicPath,
        ...(route.navigator
          ? { navigator: withGeneratedRoutePaths(route.navigator, publicPath) }
          : {}),
      };
    }),
  };
}

/*** Resolve one safe route segment to its canonical public path while omitting groups and index. */
function resolvePublicRoutePath(
  parentPath: string,
  routeName: string,
  authoredPath: string | undefined,
): string {
  if (authoredPath?.startsWith('/')) return authoredPath || '/';
  const parentSegments = parentPath.split('/').filter(Boolean);
  const authoredSegments = authoredPath?.split('/').filter(Boolean);
  const routeSegments = authoredSegments ?? [routeName];
  const publicSegments = routeSegments.flatMap((segment) => {
    if (segment === 'index' || /^\(.*\)$/u.test(segment)) return [];
    const dynamic = /^\[([^\]]+)\]$/u.exec(segment)?.[1];
    return [dynamic ? `:${dynamic.replace(/^\.\.\./u, '')}` : segment];
  });
  const resolved = [...parentSegments, ...publicSegments].join('/');
  return resolved.length === 0 ? '/' : `/${resolved}`;
}

/*** Read the concrete semantic version from Expo Runtime's package range. */
function resolveExactVersion(versionRange: string): string {
  const version = /\d+\.\d+\.\d+/u.exec(versionRange)?.[0];
  if (!version)
    throw new Error(`Expo Router range ${JSON.stringify(versionRange)} has no version.`);
  return version;
}

/*** Add an Expo platform suffix to a generated TypeScript layout path. */
function platformPath(filePath: string, platform: NavigatorRuntimePlatform): string {
  if (!filePath.endsWith('.tsx')) {
    throw new Error(`Navigator emitted a non-TSX layout path ${JSON.stringify(filePath)}.`);
  }
  return `${filePath.slice(0, -4)}.${platform}.tsx`;
}
