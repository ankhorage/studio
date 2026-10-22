import type { AppManifest } from '@ankhorage/contracts';

import type { LayoutMutation } from '../../modules/layout';
import type { GeneratedImportRequirement } from '../generatedImportComposer';

export interface RootNavigationContent {
  declarations: string;
  jsx: string;
  usesTheme: boolean;
}

interface RootLayoutAuthRuntimeConfig {
  signInRoute: string;
  signInRouteName: string;
  signUpRoute: string;
  signUpRouteName: string;
  postSignInRoute: string;
  publicRoutes: string[];
}

interface GetRootLayoutTsxArgs {
  manifest: AppManifest;
  mutations: LayoutMutation[];
  allImports: string;
  allHooks: string;
  innerNavigation: RootNavigationContent;
  includeStudio: boolean;
  authRuntime?: RootLayoutAuthRuntimeConfig;
  initialRouteNameOverride?: string;
  runtimeProviderEnd?: string[];
  runtimeProviderStart?: string[];
}

/***
 * Describe generated root-layout imports for splash-screen lifecycle and Studio media-picker ownership.
 */
export function getRootLayoutImportRequirements(
  includeStudio: boolean,
): GeneratedImportRequirement[] {
  return [
    {
      source: 'react',
      namedImports: [{ imported: 'ReactNode', typeOnly: true }, { imported: 'useEffect' }],
    },
    {
      source: 'expo-splash-screen',
      namespaceImport: 'SplashScreen',
    },
    ...(includeStudio
      ? [
          {
            source: '@ankhorage/expo-runtime/media-picker',
            namedImports: [{ imported: 'createExpoMediaPickerAdapter' }],
          },
        ]
      : []),
  ];
}

/***
 * Indent every non-empty line in a generated multiline block while preserving blank lines.
 * Utility candidate: @ankhorage/utility/string
 */
function indentGeneratedBlock(content: string, indent = '  '): string {
  return content
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

/***
 * Generate the complete Expo root-layout module by composing manifest navigation, runtime providers, optional auth integration, Studio authoring shell and generated operation infrastructure.
 * TODO: Move generated application-shell template ownership out of the generic host/layout bucket into the project/template generation domain.
 */
export function getRootLayoutTsx(args: GetRootLayoutTsxArgs) {
  const {
    manifest,
    mutations,
    allImports,
    allHooks,
    innerNavigation,
    includeStudio,
    authRuntime,
    initialRouteNameOverride,
    runtimeProviderEnd = [],
    runtimeProviderStart = [],
  } = args;

  const moduleProvidersStart = mutations.flatMap((m) => m.providerStart);
  const moduleProvidersEnd = mutations.flatMap((m) => m.providerEnd).reverse();
  const innerThemeHook = innerNavigation.usesTheme ? '  const { theme } = useZoraTheme();\n' : '';

  const providersStart = [...runtimeProviderStart, ...moduleProvidersStart].join('\n    ');
  const providersEnd = [...moduleProvidersEnd, ...runtimeProviderEnd].join('\n    ');

  const finalJsx = providersStart ? `{${providersStart}{output}${providersEnd}}` : '{output}';
  const studioFinalJsx = finalJsx.replace('{output}', '{studioOutput}');

  const authRuntimeHook = authRuntime
    ? includeStudio
      ? `
const { authState, canAccessStudioAdmin, handleInnerContentReady, isAuthRuntimeReady, pathname } =
  useGeneratedAuthNavigation();
`
      : `
const { authState, handleInnerContentReady } = useGeneratedAuthNavigation();
`
    : '';
  const rootHookBlock = [allHooks, authRuntimeHook.trim()].filter(Boolean).join('\n\n');
  const indentedRootHookBlock =
    rootHookBlock.length > 0 ? `${indentGeneratedBlock(rootHookBlock)}\n\n` : '';

  const innerContentNode = authRuntime
    ? includeStudio
      ? `(
    <InnerContent
      authState={authState}
      canAccessStudioAdmin={canAccessStudioAdmin}
      onReady={handleInnerContentReady}
    />
  )`
      : '<InnerContent authState={authState} onReady={handleInnerContentReady} />'
    : '<InnerContent />';
  const innerContentSignature = authRuntime
    ? includeStudio
      ? `{\n  authState,\n  canAccessStudioAdmin,\n  onReady,\n}: {\n  authState: GeneratedAuthNavigationState;\n  canAccessStudioAdmin: boolean;\n  onReady?: () => void;\n}`
      : `{\n  authState,\n  onReady,\n}: {\n  authState: GeneratedAuthNavigationState;\n  onReady?: () => void;\n}`
    : '';
  const innerContentReadyHook = authRuntime
    ? `
  useEffect(() => {
    if (authState === 'pending') return;
    onReady?.();
    SplashScreen.hide();
  }, [authState, onReady]);`
    : `
  useEffect(() => {
    SplashScreen.hide();
  }, []);`;
  const innerContentPendingBoundary = authRuntime
    ? `
  if (authState === 'pending') {
    return null;
  }
`
    : '';
  const runtimeContentDeclaration = `const runtimeContent = (
    <GeneratedRuntimeShell runtimeManifest={runtimeManifest}>{appContent}</GeneratedRuntimeShell>
  );`;
  const outputDeclaration = includeStudio
    ? `const output = getGeneratedAppOutput({ appContent, appPathname, runtimeManifest });`
    : `${runtimeContentDeclaration}
  const output = runtimeContent;`;
  const generatedAppOutput = includeStudio
    ? `function getGeneratedAppOutput({
  appContent,
  appPathname,
  runtimeManifest,
}: {
  readonly appContent: ReactNode;
  readonly appPathname: string;
  readonly runtimeManifest: AppManifest;
}) {
  const runtimeContent = (
    <GeneratedRuntimeShell runtimeManifest={runtimeManifest}>{appContent}</GeneratedRuntimeShell>
  );
  if (!__DEV__ || isStudioAdminPath(appPathname)) return runtimeContent;
  return (
    <AnkhStudio
      runtimeRegistry={runtimeComponentRegistry}
      bundledMediaRegistry={bundledMediaRegistry}
    >
      {runtimeContent}
    </AnkhStudio>
  );
}`
    : '';
  const moduleLevelDeclarations = [
    includeStudio ? 'const studioMediaPicker = createExpoMediaPickerAdapter();' : '',
    innerNavigation.declarations.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
  const handleInnerContentReadyDeclaration = '';
  const indentedHandleInnerContentReadyDeclaration =
    handleInnerContentReadyDeclaration.length > 0
      ? `${indentGeneratedBlock(handleInnerContentReadyDeclaration)}\n\n`
      : '';
  const studioShellBlock = includeStudio
    ? `if (__DEV__) {
  return (
    <GeneratedRootShell>
      <StudioProvider
        projectId={ankhConfig.metadata.slug}
        initialManifest={runtimeManifest}
        activePathname={isStudioAdminPath(appPathname) ? undefined : appPathname}
        componentMeta={ZORA_COMPONENT_META}
        bindableComponentMeta={ZORA_BINDABLE_COMPONENT_META}
        mediaPicker={studioMediaPicker}
      >
        <StudioShell
          output={output}
          activeThemeMode={activeThemeMode}
          runtimeManifest={runtimeManifest}
          appPathname={appPathname}
          appLocation={appLocation}
          shouldMountAppHeader={shouldMountAppHeader}
          wrapOutput={(studioOutput) => <>${studioFinalJsx}</>}
        />
      </StudioProvider>
    </GeneratedRootShell>
  );
}`
    : '';
  const indentedStudioShellBlock =
    studioShellBlock.length > 0 ? `\n${indentGeneratedBlock(studioShellBlock)}\n` : '\n';
  const innerContentReturn = innerNavigation.jsx.includes('\n')
    ? `return (\n    ${innerNavigation.jsx}\n  );`
    : `return ${innerNavigation.jsx};`;
  const generatedAppShell =
    finalJsx === '{output}'
      ? '<AppShell>{output}</AppShell>'
      : `<AppShell>
          ${finalJsx}
        </AppShell>`;
  const generatedAppRoot = `function GeneratedAppRoot({
  appContent,
  ${includeStudio ? 'appLocation,\n  appPathname,\n  shouldMountAppHeader,\n  ' : ''}runtimeManifest,
}: {
  readonly appContent: ReactNode;
  ${includeStudio ? 'readonly appLocation: string;\n  readonly appPathname: string;\n  readonly shouldMountAppHeader: boolean;\n  ' : ''}readonly runtimeManifest: AppManifest;
}) {
  const activeTheme = resolveManifestActiveTheme(runtimeManifest);
  const activeThemeMode = resolveThemeMode(runtimeManifest.activeThemeMode, 'light');
  ${outputDeclaration}

  const shell = (
    <GeneratedThemeShell theme={activeTheme} initialMode={activeThemeMode}>
      ${generatedAppShell}
      <GeneratedStatusBar />
    </GeneratedThemeShell>
  );${indentedStudioShellBlock}  return <GeneratedRootShell>{shell}</GeneratedRootShell>;
}`;
  return `
${allImports}

void SplashScreen.preventAutoHideAsync();

${moduleLevelDeclarations}

const fallbackManifest = ankhConfig as unknown as AppManifest;
export const unstable_settings = {
  initialRouteName: '${initialRouteNameOverride ?? manifest.navigator.initialRouteName ?? 'index'}',
};

${generatedAppOutput}

${generatedAppRoot}

export default function RootLayout() {
${indentedRootHookBlock}  const manifestContext = useOptionalManifestContext();
  const runtimeManifest = manifestContext?.manifest ?? fallbackManifest;
${indentedHandleInnerContentReadyDeclaration}  const appContent = ${innerContentNode};
  ${
    includeStudio
      ? `const appPathname = ${authRuntime ? 'pathname' : 'usePathname()'};
  const appLocation = resolveStudioNavigableLocation(appPathname);
  const shouldMountAppHeader =
    !isStudioAdminPath(appPathname) &&
    ${authRuntime ? 'shouldMountAuthenticatedAppHeader(appPathname, isAuthRuntimeReady)' : 'true'};
  `
      : ''
  }return ${
    includeStudio
      ? `(\n    <GeneratedAppRoot\n      appContent={appContent}\n      appLocation={appLocation}\n      appPathname={appPathname}\n      shouldMountAppHeader={shouldMountAppHeader}\n      runtimeManifest={runtimeManifest}\n    />\n  )`
      : '<GeneratedAppRoot appContent={appContent} runtimeManifest={runtimeManifest} />'
  };
}

function InnerContent(${innerContentSignature}) {${innerContentReadyHook}
${innerThemeHook}${innerContentPendingBoundary}  ${innerContentReturn}
}
`.trimStart();
}
