import type { AppManifest } from '@ankhorage/contracts';

import type { GeneratedImportRequirement } from '../generatedImportComposer';

/*** Describe the imports owned by the generated Studio app-header module. */
export function getStudioAppHeaderImportRequirements(
  zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free',
): GeneratedImportRequirement[] {
  return [
    {
      source: '@ankhorage/contracts',
      namedImports: [
        { imported: 'AppManifest', typeOnly: true },
        { imported: 'NavigatorNode', typeOnly: true },
        { imported: 'RouteDefinition', typeOnly: true },
      ],
    },
    {
      source: '@ankhorage/studio/ui/useStudioAppBarAugmentation',
      namedImports: [{ imported: 'useStudioAppBarAugmentation' }],
    },
    {
      source: '@ankhorage/studio/routeUtils',
      namedImports: [{ imported: 'resolveScreenIdForPathname' }],
    },
    { source: zoraEntrypoint, namedImports: [{ imported: 'AppBar' }] },
    {
      source: '@ankhorage/utility/object',
      namedImports: [{ imported: 'readOwnProperty' }],
    },
  ];
}

/*** Generate the Studio app-header composition and manifest title resolution. */
export function getStudioAppHeaderTsx(imports: string): string {
  return `${imports}

export function StudioAppHeader({ appHeaderTitle }: { readonly appHeaderTitle: string }) {
  const studioAppBar = useStudioAppBarAugmentation();
  return (
    <>
      <AppBar title={appHeaderTitle} actions={studioAppBar.actions} />
      {studioAppBar.overlays}
    </>
  );
}

export function resolveStudioAppHeaderTitle(args: {
  readonly activeScreenId: string | null;
  readonly pathname: string;
  readonly previewMode: boolean;
  readonly runtimeManifest: AppManifest;
  readonly studioManifest: AppManifest | null;
}): string {
  return resolveStudioPreviewHeaderTitle(args) ?? resolveRuntimeAppHeaderTitle(args);
}

function resolveStudioPreviewHeaderTitle({
  activeScreenId,
  previewMode,
  runtimeManifest,
  studioManifest,
}: Omit<Parameters<typeof resolveStudioAppHeaderTitle>[0], 'pathname'>): string | null {
  if (!previewMode || !activeScreenId) return null;
  const manifest = studioManifest ?? runtimeManifest;
  const screen = readOwnProperty<AppManifest['screens'][string]>(manifest.screens, activeScreenId);
  if (!screen) return null;
  return (
    findRouteByScreenId(manifest.navigator, activeScreenId)?.label ?? screen.title ?? screen.name
  );
}

function resolveRuntimeAppHeaderTitle({
  runtimeManifest,
  pathname,
}: {
  readonly pathname: string;
  readonly runtimeManifest: AppManifest;
}): string {
  const screenId = resolveScreenIdForPathname(
    runtimeManifest.navigator,
    pathname,
    runtimeManifest.screens,
  );
  const screen = resolveManifestScreen(runtimeManifest, screenId);
  const route = screenId ? findRouteByScreenId(runtimeManifest.navigator, screenId) : null;
  return route?.label ?? screen?.title ?? screen?.name ?? route?.name ?? 'App';
}

function findRouteByScreenId(navigator: NavigatorNode, screenId: string): RouteDefinition | null {
  for (const route of navigator.routes) {
    if (route.screenId === screenId) return route;
    if (route.navigator) {
      const nestedRoute = findRouteByScreenId(route.navigator, screenId);
      if (nestedRoute) return nestedRoute;
    }
  }
  return null;
}

function resolveManifestScreen(manifest: AppManifest, screenId: string | null | undefined) {
  return screenId
    ? readOwnProperty<AppManifest['screens'][string]>(manifest.screens, screenId)
    : undefined;
}
`;
}
