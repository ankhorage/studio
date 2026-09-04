import type { AppManifest, NavigatorNode, RouteDefinition } from '@ankhorage/contracts';

import { escapeStringLiteral } from '../utils/escapeStringLiteral';

export interface BuiltNavigatorJsx {
  declarations: string;
  jsx: string;
  usesTheme: boolean;
  usesIcon: boolean;
  usesZoraTabBar: boolean;
  usesZoraDrawerContent: boolean;
  usesZoraNavigationRouteMap: boolean;
}

/***
 * Build the generated header-visibility expression for a navigator, hiding headers in Studio development mode when Studio integration is included.
 */
function getNavigatorHeaderShownTsx(includeStudio: boolean): string {
  return includeStudio ? '__DEV__ ? false : true' : 'true';
}

/***
 * Build generated tab navigator screen options with Studio-aware header visibility and theme-driven colors.
 */
function getTabsOptionsTsx(includeStudio: boolean): string {
  return `{
  headerShown: ${getNavigatorHeaderShownTsx(includeStudio)},
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.textSecondary,
  tabBarStyle: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
  },
}`;
}

/***
 * Build generated drawer navigator screen options with Studio-aware header visibility and theme-driven colors.
 */
function getDrawerOptionsTsx(includeStudio: boolean): string {
  return `{
  headerShown: ${getNavigatorHeaderShownTsx(includeStudio)},
  drawerActiveTintColor: theme.colors.primary,
  drawerInactiveTintColor: theme.colors.textSecondary,
  drawerStyle: {
    backgroundColor: theme.colors.background,
  },
  headerStyle: {
    backgroundColor: theme.colors.surface,
  },
  headerTintColor: theme.colors.text,
}`;
}

/***
 * Build generated stack navigator screen options with Studio-aware header visibility.
 */
function getStackOptionsTsx(includeStudio: boolean): string {
  return `{
  headerShown: ${getNavigatorHeaderShownTsx(includeStudio)},
}`;
}

/***
 * Generate the declaration and JSX fragments required for the manifest navigator type and report which generated runtime imports it needs.
 */
export function buildNavigatorJsx(args: {
  navigator: NavigatorNode;
  manifest: AppManifest;
  includeStudio: boolean;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio } = args;

  if (navigator.type === 'tabs') {
    return buildTabsNavigatorJsx({ navigator, manifest, includeStudio });
  }

  if (navigator.type === 'drawer') {
    return buildDrawerNavigatorJsx({ navigator, manifest, includeStudio });
  }

  return buildStackNavigatorJsx({ navigator, manifest, includeStudio });
}

/***
 * Generate tab-navigator declarations and JSX, preferring the ZORA route-map integration when every route belongs in primary navigation and falling back to Expo Router options otherwise.
 */
function buildTabsNavigatorJsx(args: {
  navigator: NavigatorNode;
  manifest: AppManifest;
  includeStudio: boolean;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio } = args;
  const hasHiddenRoutes = navigator.routes.some((route) => route.showInPrimaryNavigation === false);
  const headerShown = getNavigatorHeaderShownTsx(includeStudio);

  if (!hasHiddenRoutes) {
    const routeMapDeclaration = buildRouteMapDeclaration({ routes: navigator.routes, manifest });
    const screenTemplates = navigator.routes.map((route, index) =>
      buildTabsScreenJsx(route, manifest, index),
    );
    const declarations = [
      routeMapDeclaration,
      `const tabsNavigatorScreenOptions = {
  headerShown: ${headerShown},
};`,
      `function renderZoraTabBar(props: BottomTabBarProps) {
  return <ZoraTabBar {...props} routeMap={routeMap} />;
}`,
      ...screenTemplates.map((screen) => screen.declaration),
    ]
      .filter(Boolean)
      .join('\n');
    const screens = screenTemplates.map((screen) => screen.jsx).join('\n');

    return {
      declarations,
      jsx: `<Tabs tabBar={renderZoraTabBar} screenOptions={tabsNavigatorScreenOptions}>
${screens}
    </Tabs>`,
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: true,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: true,
    };
  }

  const screenTemplates = navigator.routes.map((route, index) =>
    buildTabsScreenFallbackJsx(route, manifest, index),
  );
  const declarations = screenTemplates
    .map((screen) => screen.declaration)
    .filter(Boolean)
    .join('\n');
  const screens = screenTemplates.map((screen) => screen.jsx).join('\n');
  const usesIcon = navigator.routes.some((route) => Boolean(route.icon));

  return {
    declarations: [
      `const tabsNavigatorScreenOptions = ${getTabsOptionsTsx(includeStudio)};`,
      declarations,
    ]
      .filter(Boolean)
      .join('\n'),
    jsx: `<Tabs screenOptions={tabsNavigatorScreenOptions}>
${screens}
    </Tabs>`,
    usesTheme: true,
    usesIcon,
    usesZoraTabBar: false,
    usesZoraDrawerContent: false,
    usesZoraNavigationRouteMap: false,
  };
}

/***
 * Generate drawer-navigator declarations and JSX, preferring the ZORA route-map integration when every route belongs in primary navigation and falling back to Expo Router options otherwise.
 */
function buildDrawerNavigatorJsx(args: {
  navigator: NavigatorNode;
  manifest: AppManifest;
  includeStudio: boolean;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio } = args;
  const hasHiddenRoutes = navigator.routes.some((route) => route.showInPrimaryNavigation === false);
  const headerShown = getNavigatorHeaderShownTsx(includeStudio);

  if (!hasHiddenRoutes) {
    const routeMapDeclaration = buildRouteMapDeclaration({ routes: navigator.routes, manifest });
    const screenTemplates = navigator.routes.map((route, index) =>
      buildDrawerScreenJsx(route, manifest, index),
    );
    const declarations = [
      routeMapDeclaration,
      `const drawerNavigatorScreenOptions = {
  headerShown: ${headerShown},
};`,
      `function renderZoraDrawerContent(props: DrawerContentComponentProps) {
  return <ZoraDrawerContent {...props} routeMap={routeMap} />;
}`,
      ...screenTemplates.map((screen) => screen.declaration),
    ]
      .filter(Boolean)
      .join('\n');
    const screens = screenTemplates.map((screen) => screen.jsx).join('\n');

    return {
      declarations,
      jsx: `<Drawer drawerContent={renderZoraDrawerContent} screenOptions={drawerNavigatorScreenOptions}>
${screens}
    </Drawer>`,
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: true,
      usesZoraNavigationRouteMap: true,
    };
  }

  const screenTemplates = navigator.routes.map((route, index) =>
    buildDrawerScreenFallbackJsx(route, manifest, index),
  );
  const declarations = screenTemplates
    .map((screen) => screen.declaration)
    .filter(Boolean)
    .join('\n');
  const screens = screenTemplates.map((screen) => screen.jsx).join('\n');
  const usesIcon = navigator.routes.some((route) => Boolean(route.icon));

  return {
    declarations: [
      `const drawerNavigatorScreenOptions = ${getDrawerOptionsTsx(includeStudio)};`,
      declarations,
    ]
      .filter(Boolean)
      .join('\n'),
    jsx: `<Drawer screenOptions={drawerNavigatorScreenOptions}>
${screens}
    </Drawer>`,
    usesTheme: true,
    usesIcon,
    usesZoraTabBar: false,
    usesZoraDrawerContent: false,
    usesZoraNavigationRouteMap: false,
  };
}

/***
 * Generate stack-navigator declarations and JSX for the manifest routes.
 */
function buildStackNavigatorJsx(args: {
  navigator: NavigatorNode;
  manifest: AppManifest;
  includeStudio: boolean;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio } = args;
  const screenTemplates = navigator.routes.map((route, index) =>
    buildStackScreenJsx(route, manifest, index),
  );
  const declarations = screenTemplates
    .map((screen) => screen.declaration)
    .filter(Boolean)
    .join('\n');
  const screens = screenTemplates.map((screen) => screen.jsx).join('\n');

  return {
    declarations: [
      `const stackNavigatorScreenOptions = ${getStackOptionsTsx(includeStudio)};`,
      declarations,
    ]
      .filter(Boolean)
      .join('\n'),
    jsx: `<Stack screenOptions={stackNavigatorScreenOptions}>
${screens}
    </Stack>`,
    usesTheme: false,
    usesIcon: false,
    usesZoraTabBar: false,
    usesZoraDrawerContent: false,
    usesZoraNavigationRouteMap: false,
  };
}

/***
 * Generate one ZORA-integrated tab screen declaration and JSX reference from a manifest route.
 */
function buildTabsScreenJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const headerVisibilityLine = route.navigator ? `\n  headerShown: false,` : '';

  return {
    declaration: `const ${optionsConstName} = {
  title: '${label}',
  tabBarLabel: '${label}',${headerVisibilityLine}
};`,
    jsx: `      <Tabs.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

/***
 * Generate one fallback tab screen declaration and JSX reference, including hidden-route and icon options when required.
 */
function buildTabsScreenFallbackJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const hideHrefOption = route.showInPrimaryNavigation === false ? 'href: null,' : '';
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const iconFunctionName = buildScreenIconFunctionName(route, index);
  const optionLines = [
    `title: '${label}',`,
    `tabBarLabel: '${label}',`,
    route.icon ? `tabBarIcon: ${iconFunctionName},` : '',
    hideHrefOption,
  ]
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join('\n');

  const iconProvider = route.icon?.provider
    ? ` provider="${escapeStringLiteral(resolveIconProvider(route.icon.provider))}"`
    : '';

  return {
    declaration: [
      route.icon
        ? `function ${iconFunctionName}({ color, size }: { color: string; size: number }) {
  return (
    <Icon name="${escapeStringLiteral(route.icon.name)}"${iconProvider} color={color} size={size} />
  );
}`
        : '',
      `const ${optionsConstName} = {\n${optionLines}\n};`,
    ]
      .filter(Boolean)
      .join('\n'),
    jsx: `      <Tabs.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

/***
 * Generate one ZORA-integrated drawer screen declaration and JSX reference from a manifest route.
 */
function buildDrawerScreenJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const headerVisibilityLine = route.navigator ? `\n  headerShown: false,` : '';

  return {
    declaration: `const ${optionsConstName} = {
  title: '${label}',
  drawerLabel: '${label}',${headerVisibilityLine}
};`,
    jsx: `      <Drawer.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

/***
 * Generate one fallback drawer screen declaration and JSX reference, including hidden-route and icon options when required.
 */
function buildDrawerScreenFallbackJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const hideDrawerOption =
    route.showInPrimaryNavigation === false ? "drawerItemStyle: { display: 'none' }," : '';
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const iconFunctionName = buildScreenIconFunctionName(route, index);
  const optionLines = [
    `title: '${label}',`,
    `drawerLabel: '${label}',`,
    route.icon ? `drawerIcon: ${iconFunctionName},` : '',
    hideDrawerOption,
  ]
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join('\n');

  return {
    declaration: [
      route.icon
        ? `function ${iconFunctionName}({ color, size }: { color: string; size: number }) {
  return (
    <Icon name="${escapeStringLiteral(route.icon.name)}"${route.icon.provider ? ` provider="${escapeStringLiteral(route.icon.provider)}"` : ''} color={color} size={size} />
  );
}`
        : '',
      `const ${optionsConstName} = {\n${optionLines}\n};`,
    ]
      .filter(Boolean)
      .join('\n'),
    jsx: `      <Drawer.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

/***
 * Generate one stack screen declaration and JSX reference, adding only the route-specific options that are required.
 */
function buildStackScreenJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const options: string[] = [];

  if (route.name === 'index') {
    options.push(`headerTitle: '${label}'`);
  }

  if (route.navigator) {
    options.push('headerShown: false');
  }

  if (options.length === 0) {
    return {
      declaration: '',
      jsx: `      <Stack.Screen key="${route.name}" name="${route.name}" />`,
    };
  }

  const optionsConstName = buildScreenOptionsConstName(route, index);

  return {
    declaration: `const ${optionsConstName} = { ${options.join(', ')} };`,
    jsx: `      <Stack.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

/***
 * Resolve and escape the display label for a route, preferring explicit route metadata before screen metadata and the route name.
 */
function resolveRouteLabel(route: RouteDefinition, manifest: AppManifest): string {
  const screen = route.screenId ? manifest.screens[route.screenId] : undefined;
  return escapeStringLiteral(route.label ?? screen?.title ?? screen?.name ?? route.name);
}

/***
 * Generate the ZORA navigation route-map declaration for the manifest routes, including optional icon metadata.
 */
function buildRouteMapDeclaration(args: {
  routes: RouteDefinition[];
  manifest: AppManifest;
}): string {
  const { routes, manifest } = args;

  const entries = routes
    .map((route) => {
      const label = resolveRouteLabel(route, manifest);
      const key = escapeStringLiteral(route.name);
      const routeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? key : `'${key}'`;
      const iconSpec = route.icon ? buildRouteIconLiteral(route.icon) : '';
      const iconLine = iconSpec.length > 0 ? `\n    icon: ${iconSpec},` : '';

      return `  ${routeKey}: {\n    label: '${label}',${iconLine}\n  }`;
    })
    .join(',\n');

  return `const routeMap: ZoraNavigationRouteMap = {\n${entries},\n};\n`;
}

/***
 * Generate a serialized ZORA route-icon object literal from manifest icon metadata.
 */
function buildRouteIconLiteral(icon: NonNullable<RouteDefinition['icon']>): string {
  const provider = icon.provider
    ? `, provider: '${escapeStringLiteral(resolveIconProvider(icon.provider))}'`
    : '';
  const size =
    icon.size === undefined
      ? ''
      : `, size: ${typeof icon.size === 'number' ? icon.size : `'${escapeStringLiteral(String(icon.size))}'`}`;
  const color = icon.color ? `, color: '${escapeStringLiteral(icon.color)}'` : '';

  return `{ name: '${escapeStringLiteral(icon.name)}'${provider}${size}${color} }`;
}

/***
 * Translate the manifest's legacy material-community provider identifier to the runtime ZORA provider name while preserving every other provider.
 * @todo Move provider-name normalization to the icon/navigation owner instead of keeping contract-to-runtime mapping inside a layout template.
 */
function resolveIconProvider(provider: string): string {
  return provider === 'material-community' ? 'MaterialDesignIcons' : provider;
}

/***
 * Build a stable generated screen-options constant name from the route name and route index.
 */
function buildScreenOptionsConstName(route: RouteDefinition, index: number): string {
  const normalizedName = route.name.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const parts = normalizedName.length > 0 ? normalizedName.split(/\s+/) : [];
  const [firstPart = 'route', ...remainingParts] = parts;
  const camelName = [
    firstPart.toLowerCase(),
    ...remainingParts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()),
  ].join('');

  return `route${index}${camelName.charAt(0).toUpperCase() + camelName.slice(1)}ScreenOptions`;
}

/***
 * Derive the generated route-icon render-function name from the corresponding screen-options constant name.
 */
function buildScreenIconFunctionName(route: RouteDefinition, index: number): string {
  return buildScreenOptionsConstName(route, index).replace(/ScreenOptions$/, 'Icon');
}
