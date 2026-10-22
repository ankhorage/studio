import type { GeneratedImportRequirement } from '../generatedImportComposer';

/*** Describe the imports owned by the generated application root shell. */
export function getRootShellImportRequirements(
  zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free',
): GeneratedImportRequirement[] {
  return [
    { source: '@ankhorage/contracts', namedImports: [{ imported: 'AppManifest', typeOnly: true }] },
    {
      source: 'react',
      namedImports: [{ imported: 'ReactNode', typeOnly: true }, { imported: 'useMemo' }],
    },
    { source: '@ankhorage/utility/object', namedImports: [{ imported: 'readOwnProperty' }] },
    {
      source: '@ankhorage/expo-runtime/icon-fonts',
      namedImports: [{ imported: 'ExpoZoraIconFontProvider' }],
    },
    {
      source: zoraEntrypoint,
      namedImports: [{ imported: 'ZoraProvider' }, { imported: 'useZoraTheme' }],
    },
    { source: 'expo-status-bar', namedImports: [{ imported: 'StatusBar' }] },
    {
      source: 'react-native-gesture-handler',
      namedImports: [{ imported: 'GestureHandlerRootView' }],
    },
    { source: 'react-native-safe-area-context', namedImports: [{ imported: 'SafeAreaProvider' }] },
  ];
}

/*** Generate the application-wide React Native root, theme provider and status-bar shell. */
export function getRootShellTsx(imports: string): string {
  return `${imports}

const rootViewStyle = { flex: 1 } as const;

export function GeneratedRootShell({ children }: { readonly children: ReactNode }) {
  return (
    <ExpoZoraIconFontProvider>
      <GestureHandlerRootView style={rootViewStyle}>{children}</GestureHandlerRootView>
    </ExpoZoraIconFontProvider>
  );
}

export function GeneratedThemeShell({
  children,
  initialMode,
  theme,
}: {
  readonly children: ReactNode;
  readonly initialMode: NonNullable<AppManifest['activeThemeMode']>;
  readonly theme: AppManifest['themes'][string];
}) {
  const themeConfig = useMemo(() => resolveZoraSurfaceThemeConfig(theme), [theme]);
  return (
    <ZoraProvider themeConfig={themeConfig} initialMode={initialMode}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </ZoraProvider>
  );
}

export function GeneratedStatusBar() {
  const { mode } = useZoraTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export function resolveManifestActiveTheme(manifest: AppManifest): AppManifest['themes'][string] {
  const theme = readOwnProperty<AppManifest['themes'][string]>(
    manifest.themes,
    manifest.activeThemeId,
  );
  if (!theme) throw new Error("Manifest active theme '" + manifest.activeThemeId + "' is missing.");
  return theme;
}

export function resolveThemeMode(
  mode: AppManifest['activeThemeMode'],
  fallback: NonNullable<AppManifest['activeThemeMode']>,
): NonNullable<AppManifest['activeThemeMode']> {
  return mode === 'dark' || mode === 'light' ? mode : fallback;
}

function resolveZoraSurfaceThemeConfig(
  theme: AppManifest['themes'][string],
): AppManifest['themes'][string] {
  return {
    id: theme.id,
    name: theme.name,
    light: { ...theme.light },
    dark: { ...theme.dark },
    ...(theme.tokens === undefined ? {} : { tokens: theme.tokens }),
    ...(theme.recipes === undefined ? {} : { recipes: theme.recipes }),
  };
}
`;
}
