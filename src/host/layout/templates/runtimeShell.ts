import type { GeneratedImportRequirement } from '../generatedImportComposer';

/*** Describe imports owned by the generated Runtime composition shell. */
export function getRuntimeShellImportRequirements(
  includeStudio: boolean,
  zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free',
  useStoredAuthSessionCredentialResolver: boolean,
): GeneratedImportRequirement[] {
  return [
    {
      source: '@ankhorage/contracts',
      namedImports: [
        { imported: 'AppManifest', typeOnly: true },
        { imported: 'DataSourceDiagnostic', typeOnly: true },
      ],
    },
    {
      source: 'react',
      namedImports: [{ imported: 'ReactNode', typeOnly: true }, { imported: 'useMemo' }],
    },
    {
      source: '@ankhorage/runtime',
      namedImports: [
        { imported: 'composeRuntimeCapabilityExecutor' },
        { imported: 'createComponentRegistry' },
        { imported: 'createRuntimeApiCapabilityExecutor' },
        { imported: 'RuntimeRendererConfigProvider' },
      ],
    },
    {
      source: zoraEntrypoint,
      namedImports: [{ imported: 'useZoraTheme' }, { imported: 'ZORA_COMPONENT_META' }],
    },
    {
      source: '@ankhorage/expo-runtime/bundled-media',
      namedImports: [{ imported: 'createExpoBundledMediaResolver' }],
    },
    {
      source: '@/generated/bundledMediaRegistry',
      namedImports: [{ imported: 'bundledMediaRegistry' }],
    },
    {
      source: '@/generated/appExtensionRegistry',
      namedImports: [
        {
          imported: 'APP_EXTENSION_COMPONENT_REGISTRY',
          local: 'GENERATED_APP_EXTENSION_COMPONENT_REGISTRY',
        },
      ],
    },
    ...(useStoredAuthSessionCredentialResolver
      ? [
          {
            source: '@/auth/session',
            namedImports: [{ imported: 'getStoredAuthSession' }],
          },
        ]
      : []),
    ...(includeStudio
      ? [
          {
            source: '@ankhorage/studio/runtime',
            namedImports: [{ imported: 'useStudioRuntimeCapabilityExecutor' }],
          },
        ]
      : [
          {
            source: '@/generated/runtimeCapabilityExecutor',
            namedImports: [{ imported: 'createGeneratedRuntimeCapabilityExecutor' }],
          },
          {
            source: '@ankhorage/expo-runtime/capability-bridge',
            namedImports: [{ imported: 'resolveExpoRuntimeRoutePath' }],
          },
          {
            source: 'expo-router',
            namedImports: [{ imported: 'Href', typeOnly: true }, { imported: 'useRouter' }],
          },
        ]),
    { source: 'react-native', namedImports: [{ imported: 'Alert' }, { imported: 'Platform' }] },
  ];
}

/*** Generate Runtime capability, API, registry, media, and renderer composition for one app configuration. */
export function getRuntimeShellTsx(args: {
  readonly imports: string;
  readonly includeStudio: boolean;
  readonly runtimeModuleDeclarations?: string;
  readonly useStoredAuthSessionCredentialResolver: boolean;
  readonly zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free';
}): string {
  const {
    imports,
    includeStudio,
    runtimeModuleDeclarations,
    useStoredAuthSessionCredentialResolver,
    zoraEntrypoint,
  } = args;
  const runtimeCredentialResolver = useStoredAuthSessionCredentialResolver
    ? '\n          credentialResolver: resolveRuntimeOperationCredential,'
    : '';
  const capabilityExecutor = includeStudio
    ? `useStudioRuntimeCapabilityExecutor({
    setThemeMode: setMode,
  })`
    : 'useGeneratedRuntimeCapabilityExecutor()';
  const standaloneExecutor = includeStudio
    ? ''
    : `
function useGeneratedRuntimeCapabilityExecutor() {
  const router = useRouter();
  const { setMode } = useZoraTheme();
  const executeCapability = useMemo(
    () =>
      createGeneratedRuntimeCapabilityExecutor({
        alert: (message) => Alert.alert(message),
        navigate: (input) => {
          const { params, route } = input as { route: string; params?: Record<string, string> };
          const { resolvedPath, unusedParams } = resolveExpoRuntimeRoutePath(route, params);
          router.navigate({ params: unusedParams, pathname: resolvedPath } as Href);
        },
        setThemeMode: (input) => setMode((input as { mode: 'dark' | 'light' }).mode),
      }),
    [router, setMode],
  );

  return { executeCapability };
}
`;
  const credentialResolver = useStoredAuthSessionCredentialResolver
    ? `
function resolveRuntimeOperationCredential(credential: { readonly kind?: string } | undefined) {
  if (credential?.kind !== 'bearer' && credential?.kind !== 'oauth2') return undefined;

  const session = getStoredAuthSession();
  if (!session?.accessToken) return undefined;

  return {
    headers: {
      Authorization: \`Bearer \${session.accessToken}\`,
    },
  };
}
`
    : '';

  return (
    `${imports}

${runtimeModuleDeclarations?.trim() ?? ''}

${includeStudio ? 'export { bundledMediaRegistry };\n' : ''}const bundledMediaResolver = createExpoBundledMediaResolver(bundledMediaRegistry);
${includeStudio ? 'export ' : ''}const runtimeComponentRegistry = APP_COMPONENT_REGISTRY;

/** Resolve the component event identity published by ZORA for Runtime binding lookup. */
function resolveZoraRuntimeEventCapability({ eventName, node }: { eventName: string; node: { type: string } }) {
  return ZORA_COMPONENT_META[node.type]?.events?.[eventName]?.eventType;
}

/** Present Runtime action diagnostics rather than leaving failed interactions as silent no-ops. */
function reportRuntimeDiagnostics(diagnostics: readonly DataSourceDiagnostic[]) {
  const messages = diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.message);
  if (messages.length === 0) return;

  const message = messages.join('\\n');
  if (Platform.OS === 'web') {
    globalThis.alert(\`Action unavailable\\n\\n\${message}\`);
    return;
  }
  Alert.alert('Action unavailable', message);
}

export function GeneratedRuntimeShell({
  children,
  runtimeManifest,
}: {
  readonly children: ReactNode;
  readonly runtimeManifest: AppManifest;
}) {${includeStudio ? '\n  const { setMode } = useZoraTheme();' : ''}
  const runtimeCapabilityExecutor = ${capabilityExecutor};
  const executeApplicationCapability = runtimeCapabilityExecutor.executeCapability;
  const executeCapability = useMemo(
    () =>
      composeRuntimeCapabilityExecutor({
        apiCapabilityExecutor: createRuntimeApiCapabilityExecutor({
          apis: runtimeManifest.infra.apis ?? {},
          fetch: runtimeApiFetch,${runtimeCredentialResolver}
        }),
        capabilityExecutor: executeApplicationCapability,
      }),
    [executeApplicationCapability, runtimeManifest.infra.apis],
  );
  const generatedRuntimeConfig = useMemo(
    () => ({
      executeCapability,
      registry: runtimeComponentRegistry,
      mediaAssets: runtimeManifest.media?.assets,
      onDiagnostics: reportRuntimeDiagnostics,
      resolveMediaAsset: bundledMediaResolver,
      resolveEventCapability: resolveZoraRuntimeEventCapability,
    }),
    [executeCapability, runtimeManifest.media?.assets],
  );

  return (
    <RuntimeRendererConfigProvider value={generatedRuntimeConfig}>
      {children}
    </RuntimeRendererConfigProvider>
  );
}

async function runtimeApiFetch(
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
) {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text: () => response.text(),
  };
}
${credentialResolver}${standaloneExecutor}`.trimEnd() + '\n'
  );
}
