import type { AppManifest, NavigatorNode, RouteDefinition } from '@ankhorage/contracts';
import type { NavigatorGenerationBindings, NavigatorScreenModule } from '@ankhorage/navigator';

import type { GeneratedFile } from '../layoutGenerator';
import { escapeStringLiteral } from '../utils/escapeStringLiteral';

const GUARD_BINDINGS_MODULE = '@/generated/navigatorGuardBindings';
const ICON_BINDINGS_MODULE = '@/generated/navigatorIconBindings';
const SCREEN_BINDINGS_MODULE = '@/generated/navigatorScreenBindings';

interface NavigatorRootBindingInput {
  navigator: NavigatorNode;
  rootDirectory: string;
}

interface CreateNavigatorGenerationBindingsInput {
  authEnabled: boolean;
  manifest: AppManifest;
  roots: readonly NavigatorRootBindingInput[];
}

interface NavigatorGenerationBindingResult {
  bindings: NavigatorGenerationBindings;
  files: GeneratedFile[];
}

/*** Build the narrow module/symbol registry consumed by Navigator without forwarding AppManifest. */
export function createNavigatorGenerationBindings(
  input: CreateNavigatorGenerationBindingsInput,
): NavigatorGenerationBindingResult {
  const screenModules = collectScreenModules(input.roots);
  const requiredScreenIds = collectLayoutScreenIds(input.roots);
  const screenEntries = [...requiredScreenIds].flatMap((screenId, index) => {
    const module = screenModules.get(screenId);
    return module ? [{ screenId, module, exportName: `NavigatorScreen${index}` }] : [];
  });
  const screens = Object.fromEntries(
    screenEntries.map(({ screenId, exportName }) => [
      screenId,
      { module: SCREEN_BINDINGS_MODULE, exportName },
    ]),
  );
  const guards = collectGuardBindings(input.roots, input.authEnabled);
  const iconBindingFile = createIconBindingFile(input.manifest, input.roots);
  const files = [
    ...(screenEntries.length === 0
      ? []
      : [
          {
            path: 'src/generated/navigatorScreenBindings.ts',
            content: `${screenEntries
              .map(
                ({ exportName, module }) =>
                  `export { default as ${exportName} } from '${escapeStringLiteral(module)}';`,
              )
              .join('\n')}\n`,
          },
        ]),
    ...(Object.keys(guards).length === 0
      ? []
      : [
          {
            path: 'src/generated/navigatorGuardBindings.ts',
            content: `/** Auth group guards are already enforced by Studio's generated root shell. */
export function isInOwnedAuthRouteGroup() {
  return true;
}
`,
          },
        ]),
    ...(iconBindingFile ? [iconBindingFile] : []),
  ];

  return {
    bindings: {
      screens,
      guards,
      ...(iconBindingFile
        ? {
            iconSourceResolver: {
              module: ICON_BINDINGS_MODULE,
              exportName: 'resolveNavigatorIconSource',
            },
          }
        : {}),
    },
    files,
  };
}

/*** Collect only screens rendered directly by a Navigator layout instead of cloning the app registry. */
function collectLayoutScreenIds(roots: readonly NavigatorRootBindingInput[]): Set<string> {
  const screenIds = new Set<string>();
  const visit = (navigator: NavigatorNode) => {
    if (navigator.type === 'split-view') {
      screenIds.add(navigator.columns.primary.screenId);
      if (navigator.columns.supplementary) {
        screenIds.add(navigator.columns.supplementary.screenId);
      }
      if (navigator.inspector) screenIds.add(navigator.inspector.screenId);
    }
    if (navigator.type === 'tabs') {
      if (navigator.implementation === 'native' && navigator.bottomAccessory) {
        screenIds.add(navigator.bottomAccessory.screenId);
      }
      if (
        (navigator.implementation === undefined || navigator.implementation === 'adaptive') &&
        navigator.native?.bottomAccessory
      ) {
        screenIds.add(navigator.native.bottomAccessory.screenId);
      }
    }
    for (const route of navigator.routes) {
      if (route.navigator) visit(route.navigator);
    }
  };
  for (const root of roots) visit(root.navigator);
  return screenIds;
}

/*** Map each routed screen ID to its first deterministic Studio-generated route module. */
function collectScreenModules(roots: readonly NavigatorRootBindingInput[]): Map<string, string> {
  const modules = new Map<string, string>();
  const visit = (navigator: NavigatorNode, directory: string) => {
    for (const route of navigator.routes) {
      const routePath = `${directory}/${route.name}`;
      if (route.screenId && !modules.has(route.screenId)) {
        modules.set(route.screenId, toSourceAlias(routePath));
      }
      if (route.navigator) visit(route.navigator, routePath);
    }
  };
  for (const root of roots) visit(root.navigator, root.rootDirectory);
  return modules;
}

/*** Bind only auth partition guards whose behavior is already established by the root shell. */
function collectGuardBindings(
  roots: readonly NavigatorRootBindingInput[],
  authEnabled: boolean,
): Record<string, NavigatorScreenModule> {
  const guards = new Set<string>();
  const visit = (navigator: NavigatorNode) => {
    for (const route of navigator.routes) {
      for (const guard of route.guards ?? []) guards.add(guard);
      if (route.navigator) visit(route.navigator);
    }
  };
  for (const root of roots) visit(root.navigator);

  const supported = new Set(['authenticated', 'guest', 'public']);
  return Object.fromEntries(
    [...guards]
      .filter((guard) => authEnabled && supported.has(guard.trim().toLowerCase()))
      .map((guard) => [
        guard,
        { module: GUARD_BINDINGS_MODULE, exportName: 'isInOwnedAuthRouteGroup' },
      ]),
  );
}

/*** Emit a manifest-projected icon source registry for bundled and URL-backed SVG references. */
function createIconBindingFile(
  manifest: AppManifest,
  roots: readonly NavigatorRootBindingInput[],
): GeneratedFile | null {
  const mediaIds = collectIconMediaIds(roots);
  if (mediaIds.length === 0) return null;
  const cases = mediaIds.map((mediaId) => {
    const asset = Object.values(manifest.media?.assets ?? {}).find(({ id }) => id === mediaId);
    if (!asset) throw new Error(`Navigation icon media '${mediaId}' is missing from the manifest.`);
    if (asset.source.kind === 'storage') {
      throw new Error(
        `Navigation icon media '${mediaId}' requires asynchronous storage resolution.`,
      );
    }
    const source =
      asset.source.kind === 'bundled'
        ? `bundledMediaRegistry['${escapeStringLiteral(asset.source.path)}']`
        : `'${escapeStringLiteral(asset.source.url)}'`;
    return `    case '${escapeStringLiteral(mediaId)}':
      return ${source};`;
  });

  return {
    path: 'src/generated/navigatorIconBindings.ts',
    content: `import { bundledMediaRegistry } from '@/generated/bundledMediaRegistry';

export function resolveNavigatorIconSource(reference: { mediaId: string }) {
  switch (reference.mediaId) {
${cases.join('\n')}
    default:
      throw new Error(\`Navigation icon media '\${reference.mediaId}' is unavailable.\`);
  }
}
`,
  };
}

/*** Collect unique media-backed route icon references in stable traversal order. */
function collectIconMediaIds(roots: readonly NavigatorRootBindingInput[]): string[] {
  const mediaIds = new Set<string>();
  const visitRoute = (route: RouteDefinition) => {
    if (route.icon && 'source' in route.icon && route.icon.source) {
      mediaIds.add(route.icon.source.mediaId);
    }
    for (const nestedRoute of route.navigator?.routes ?? []) visitRoute(nestedRoute);
  };
  for (const root of roots) {
    for (const route of root.navigator.routes) visitRoute(route);
  }
  return [...mediaIds];
}

/*** Convert a generated file path below src into its stable alias without an extension. */
function toSourceAlias(filePath: string): string {
  if (!filePath.startsWith('src/')) {
    throw new Error(`Navigator screen path ${JSON.stringify(filePath)} is outside src.`);
  }
  return `@/${filePath.slice(4)}`;
}
