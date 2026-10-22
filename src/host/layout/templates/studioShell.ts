import type { GeneratedImportRequirement } from '../generatedImportComposer';

/***
 * Describe the imports owned by the generated Studio authoring shell.
 */
export function getStudioShellImportRequirements(
  zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free',
  zoraComponentRegistry: 'ZORA_COMPONENT_REGISTRY' | 'ZORA_BASE_COMPONENT_REGISTRY',
): GeneratedImportRequirement[] {
  return [
    { source: '@ankhorage/contracts', namedImports: [{ imported: 'AppManifest', typeOnly: true }] },
    {
      source: 'react',
      namedImports: [
        { imported: 'ReactNode', typeOnly: true },
        { imported: 'useEffect' },
        { imported: 'useMemo' },
      ],
    },
    {
      source: '@ankhorage/runtime',
      namedImports: [{ imported: 'RuntimeRendererConfigProvider' }],
    },
    {
      source: '@ankhorage/studio/runtime',
      namedImports: [
        { imported: 'createStudioActionSuppressionConfig' },
        { imported: 'createStudioInteractionPolicyResolver' },
        { imported: 'createStudioStationarySelectionWrapNode' },
        { imported: 'StationaryTapSelector' },
      ],
    },
    {
      source: '@ankhorage/studio/core/StudioContext',
      namedImports: [{ imported: 'useStudio' }],
    },
    {
      source: '@ankhorage/studio/studioAdminRouteModel',
      namedImports: [
        { imported: 'isStudioAdminPath' },
        { imported: 'resolveStudioLastNonAdminLocation' },
      ],
    },
    {
      source: zoraEntrypoint,
      namedImports: [
        { imported: 'AppShell' },
        { imported: 'useZoraTheme' },
        { imported: 'ZoraProvider' },
      ],
    },
    ...(zoraComponentRegistry === 'ZORA_COMPONENT_REGISTRY'
      ? [
          {
            source: '@ankhorage/zora',
            namedImports: [{ imported: 'ZORA_COMPONENT_REGISTRY' }],
          },
        ]
      : [
          {
            source: '@ankhorage/zora/registry',
            namedImports: [{ imported: 'ZORA_BASE_COMPONENT_REGISTRY' }],
          },
        ]),
    {
      source: 'expo-status-bar',
      namedImports: [{ imported: 'StatusBar' }],
    },
    {
      source: 'react-native-safe-area-context',
      namedImports: [{ imported: 'SafeAreaProvider' }],
    },
    {
      source: '@/generated/appExtensionRegistry',
      namedImports: [{ imported: 'APP_EXTENSION_INTERACTION_POLICY_SUPPORT' }],
    },
    {
      source: '@/generated/studioAppHeader',
      namedImports: [{ imported: 'resolveStudioAppHeaderTitle' }, { imported: 'StudioAppHeader' }],
    },
    {
      source: '@ankhorage/utility/object',
      namedImports: [{ imported: 'readOwnProperty' }],
    },
  ];
}

/***
 * Generate the Studio-only authoring shell that owns editor interaction policy, preview wrapping and Studio app chrome.
 */
export function getStudioShellTsx(args: {
  readonly imports: string;
  readonly zoraComponentRegistry: 'ZORA_COMPONENT_REGISTRY' | 'ZORA_BASE_COMPONENT_REGISTRY';
}): string {
  const { imports, zoraComponentRegistry } = args;
  return `${imports}

export interface StudioShellProps {
  readonly activeThemeMode: NonNullable<AppManifest['activeThemeMode']>;
  readonly appLocation: string;
  readonly appPathname: string;
  readonly output: ReactNode;
  readonly runtimeManifest: AppManifest;
  readonly shouldMountAppHeader: boolean;
  readonly wrapOutput: (output: ReactNode) => ReactNode;
}

type StudioSelection = Pick<
  ReturnType<typeof useStudio>,
  | 'activeCanvasDragNodeId'
  | 'componentMeta'
  | 'moveNodeToPlacement'
  | 'rootNode'
  | 'selectedNodeId'
  | 'selectNode'
  | 'setActiveCanvasDragNodeId'
>;

function useStudioRuntimeConfig(previewMode: boolean) {
  const studioWrapNode = useMemo(
    () =>
      createStudioStationarySelectionWrapNode({
        builtInComponentRegistry: ${zoraComponentRegistry},
        previewMode,
        thirdPartySupport: APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
      }),
    [previewMode],
  );
  const studioResolveNodeProps = useMemo(
    () =>
      createStudioInteractionPolicyResolver({
        builtInComponentRegistry: ${zoraComponentRegistry},
        previewMode,
        thirdPartySupport: APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
      }),
    [previewMode],
  );
  return useMemo(
    () => ({
      ...createStudioActionSuppressionConfig(previewMode),
      resolveNodeProps: studioResolveNodeProps,
      wrapNode: studioWrapNode,
    }),
    [previewMode, studioResolveNodeProps, studioWrapNode],
  );
}

export function StudioShell({
  activeThemeMode,
  appLocation,
  appPathname,
  output,
  runtimeManifest,
  shouldMountAppHeader,
  wrapOutput,
}: StudioShellProps) {
  const studio = useStudioShellState();
  useStudioLastNonAdminLocation(appLocation, appPathname, studio.setLastNonAdminLocation);
  const studioRuntimeConfig = useStudioRuntimeConfig(studio.previewMode);
  const appHeaderTitle = resolveStudioAppHeaderTitle({
    runtimeManifest,
    studioManifest: studio.manifest,
    previewMode: studio.previewMode,
    activeScreenId: studio.activeScreenId,
    pathname: appPathname,
  });
  const header = shouldMountAppHeader ? (
    <StudioAppHeader appHeaderTitle={appHeaderTitle} />
  ) : undefined;
  const studioRuntimeManifest = studio.manifest ?? runtimeManifest;
  const activeStudioTheme = resolveManifestActiveTheme(studioRuntimeManifest);
  const activeStudioThemeMode = resolveThemeMode(
    studioRuntimeManifest.activeThemeMode,
    activeThemeMode,
  );
  return (
    <StudioThemeShell initialMode={activeStudioThemeMode} theme={activeStudioTheme}>
      <StudioAppContent
        appPathname={appPathname}
        header={header}
        output={output}
        previewMode={studio.previewMode}
        runtimeConfig={studioRuntimeConfig}
        selection={studio.selection}
        wrapOutput={wrapOutput}
      />
      <StudioStatusBar />
    </StudioThemeShell>
  );
}

function useStudioShellState() {
  const {
    activeCanvasDragNodeId,
    activeScreenId,
    componentMeta,
    manifest: studioManifest,
    moveNodeToPlacement,
    previewMode,
    rootNode,
    selectedNodeId,
    selectNode,
    setActiveCanvasDragNodeId,
    setLastNonAdminLocation,
  } = useStudio();
  return {
    activeScreenId,
    manifest: studioManifest,
    previewMode,
    selection: {
      activeCanvasDragNodeId,
      componentMeta,
      moveNodeToPlacement,
      rootNode,
      selectedNodeId,
      selectNode,
      setActiveCanvasDragNodeId,
    },
    setLastNonAdminLocation,
  };
}

function StudioAppContent({
  appPathname,
  header,
  output,
  previewMode,
  runtimeConfig,
  selection,
  wrapOutput,
}: {
  readonly appPathname: string;
  readonly header: ReactNode;
  readonly output: ReactNode;
  readonly previewMode: boolean;
  readonly runtimeConfig: ReturnType<typeof useStudioRuntimeConfig>;
  readonly selection: StudioSelection;
  readonly wrapOutput: (output: ReactNode) => ReactNode;
}) {
  const { theme } = useZoraTheme();
  const studioOutput = isStudioAdminPath(appPathname) ? (
    output
  ) : (
    <StationaryTapSelector
      canvasInteraction={{
        activeDragNodeId: selection.activeCanvasDragNodeId,
        componentMeta: selection.componentMeta,
        moveNodeToPlacement: selection.moveNodeToPlacement,
        rootNode: selection.rootNode,
        setActiveDragNodeId: selection.setActiveCanvasDragNodeId,
      }}
      isEditMode={!previewMode}
      selectionColor={theme.semantics.action.primary.base}
      selectedNodeId={selection.selectedNodeId}
      selectNode={selection.selectNode}
    >
      <RuntimeRendererConfigProvider value={runtimeConfig}>{output}</RuntimeRendererConfigProvider>
    </StationaryTapSelector>
  );
  return <AppShell header={header}>{wrapOutput(studioOutput)}</AppShell>;
}

function useStudioLastNonAdminLocation(
  appLocation: string,
  appPathname: string,
  setLastNonAdminLocation: ReturnType<typeof useStudio>['setLastNonAdminLocation'],
) {
  useEffect(() => {
    const nextAppLocation = resolveStudioLastNonAdminLocation({
      pathname: appPathname,
      navigableLocation: appLocation,
    });
    if (nextAppLocation) setLastNonAdminLocation(nextAppLocation);
  }, [appLocation, appPathname, setLastNonAdminLocation]);
}

function StudioThemeShell({
  children,
  initialMode,
  theme,
}: {
  readonly children: ReactNode;
  readonly initialMode: NonNullable<AppManifest['activeThemeMode']>;
  readonly theme: AppManifest['themes'][string];
}) {
  const themeConfig = useMemo(
    () => ({
      id: theme.id,
      name: theme.name,
      light: { ...theme.light },
      dark: { ...theme.dark },
      ...(theme.tokens === undefined ? {} : { tokens: theme.tokens }),
      ...(theme.recipes === undefined ? {} : { recipes: theme.recipes }),
    }),
    [theme],
  );
  return (
    <ZoraProvider themeConfig={themeConfig} initialMode={initialMode}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </ZoraProvider>
  );
}

function StudioStatusBar() {
  const { mode } = useZoraTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

function resolveManifestActiveTheme(manifest: AppManifest): AppManifest['themes'][string] {
  const theme = readOwnProperty<AppManifest['themes'][string]>(
    manifest.themes,
    manifest.activeThemeId,
  );
  if (!theme) throw new Error("Manifest active theme '" + manifest.activeThemeId + "' is missing.");
  return theme;
}

function resolveThemeMode(
  mode: AppManifest['activeThemeMode'],
  fallback: NonNullable<AppManifest['activeThemeMode']>,
): NonNullable<AppManifest['activeThemeMode']> {
  return mode === 'dark' || mode === 'light' ? mode : fallback;
}
`;
}
