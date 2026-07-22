import type { AppManifest, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';

import { escapeStringLiteral } from '../utils/escapeStringLiteral';

export interface BuiltNavigatorJsx {
  declarations: string;
  jsx: string;
  usesTheme: boolean;
  usesIcon: boolean;
  usesZoraTabBar: boolean;
  usesZoraDrawerContent: boolean;
  usesZoraNavigationRouteMap: boolean;
  usesGeneratedAuthNavigationState?: boolean;
}

interface RouteAccessPlan {
  path: string;
  access: 'public' | 'protected' | 'auth';
}

interface NavigatorAuthJsxOptions {
  routeAccess: readonly RouteAccessPlan[];
  routeSegments?: readonly string[];
}

function getNavigatorHeaderShownTsx(includeStudio: boolean): string {
  return includeStudio ? '__DEV__ ? false : true' : 'true';
}

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

function getStackOptionsTsx(includeStudio: boolean): string {
  return `{
  headerShown: ${getNavigatorHeaderShownTsx(includeStudio)},
}`;
}

export function buildNavigatorJsx(args: {
  navigator: NavigatorSpec;
  manifest: AppManifest;
  includeStudio: boolean;
  auth?: NavigatorAuthJsxOptions;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio, auth } = args;

  if (navigator.type === 'tabs') {
    return buildTabsNavigatorJsx({ navigator, manifest, includeStudio, auth });
  }

  if (navigator.type === 'drawer') {
    return buildDrawerNavigatorJsx({ navigator, manifest, includeStudio, auth });
  }

  return buildStackNavigatorJsx({ navigator, manifest, includeStudio, auth });
}

function buildTabsNavigatorJsx(args: {
  navigator: NavigatorSpec;
  manifest: AppManifest;
  includeStudio: boolean;
  auth?: NavigatorAuthJsxOptions;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio, auth } = args;
  const hasHiddenRoutes = navigator.routes.some((route) => route.hideInTabBar === true);
  const headerShown = getNavigatorHeaderShownTsx(includeStudio);
  const routeAuth = createRouteAuthResolver(auth);

  if (!hasHiddenRoutes) {
    const routeMapDeclaration = buildRouteMapDeclaration({ routes: navigator.routes, manifest });
    const screenTemplates = navigator.routes.map((route, index) =>
      routeAuth.wrapScreenJsx(route, buildTabsScreenJsx(route, manifest, index), 'Tabs', index),
    );
    const declarations = [
      routeMapDeclaration,
      `const tabsNavigatorScreenOptions = {
  headerShown: ${headerShown},
};`,
      `function renderZoraTabBar(props: BottomTabBarProps) {
  return <ZoraTabBar {...(props as Parameters<typeof ZoraTabBar>[0])} routeMap={routeMap} />;
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
      usesGeneratedAuthNavigationState: routeAuth.usesAuthState,
    };
  }

  const screenTemplates = navigator.routes.map((route, index) =>
    routeAuth.wrapScreenJsx(
      route,
      buildTabsScreenFallbackJsx(route, manifest, index),
      'Tabs',
      index,
    ),
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
    usesGeneratedAuthNavigationState: routeAuth.usesAuthState,
  };
}

function buildDrawerNavigatorJsx(args: {
  navigator: NavigatorSpec;
  manifest: AppManifest;
  includeStudio: boolean;
  auth?: NavigatorAuthJsxOptions;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio, auth } = args;
  const hasHiddenRoutes = navigator.routes.some((route) => route.hideInTabBar === true);
  const headerShown = getNavigatorHeaderShownTsx(includeStudio);
  const routeAuth = createRouteAuthResolver(auth);

  if (!hasHiddenRoutes) {
    const routeMapDeclaration = buildRouteMapDeclaration({ routes: navigator.routes, manifest });
    const screenTemplates = navigator.routes.map((route, index) =>
      routeAuth.wrapScreenJsx(route, buildDrawerScreenJsx(route, manifest, index), 'Drawer', index),
    );
    const declarations = [
      routeMapDeclaration,
      `const drawerNavigatorScreenOptions = {
  headerShown: ${headerShown},
};`,
      `function renderZoraDrawerContent(props: DrawerContentComponentProps) {
  return <ZoraDrawerContent {...(props as Parameters<typeof ZoraDrawerContent>[0])} routeMap={routeMap} />;
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
      usesGeneratedAuthNavigationState: routeAuth.usesAuthState,
    };
  }

  const screenTemplates = navigator.routes.map((route, index) =>
    routeAuth.wrapScreenJsx(
      route,
      buildDrawerScreenFallbackJsx(route, manifest, index),
      'Drawer',
      index,
    ),
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
    usesGeneratedAuthNavigationState: routeAuth.usesAuthState,
  };
}

function buildStackNavigatorJsx(args: {
  navigator: NavigatorSpec;
  manifest: AppManifest;
  includeStudio: boolean;
  auth?: NavigatorAuthJsxOptions;
}): BuiltNavigatorJsx {
  const { navigator, manifest, includeStudio, auth } = args;
  const routeAuth = createRouteAuthResolver(auth);
  const screenTemplates = navigator.routes.map((route, index) =>
    routeAuth.wrapScreenJsx(route, buildStackScreenJsx(route, manifest, index), 'Stack', index),
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
    usesGeneratedAuthNavigationState: routeAuth.usesAuthState,
  };
}

function createRouteAuthResolver(auth: NavigatorAuthJsxOptions | undefined): {
  usesAuthState: boolean;
  wrapScreenJsx(
    route: RouteDefinition,
    screen: { declaration: string; jsx: string },
    navigatorName: 'Stack' | 'Tabs' | 'Drawer',
    index: number,
  ): { declaration: string; jsx: string };
} {
  const accessByPath = new Map(
    (auth?.routeAccess ?? []).map((route) => [route.path, route.access]),
  );
  const parentSegments = auth?.routeSegments ?? [];
  let usesAuthState = false;

  return {
    get usesAuthState() {
      return usesAuthState;
    },
    wrapScreenJsx(route, screen, navigatorName, index) {
      const routePath = segmentsToHref([...parentSegments, route.name]);
      if (accessByPath.get(routePath) !== 'protected') {
        return screen;
      }

      usesAuthState = true;
      return {
        declaration: screen.declaration,
        jsx: `      <${navigatorName}.Protected key="${route.name}-auth-boundary-${index}" guard={authState === 'authenticated'}>
${indentJsx(screen.jsx, '  ')}
      </${navigatorName}.Protected>`,
      };
    },
  };
}

function segmentsToHref(segments: readonly string[]): string {
  const pathSegments = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== 'index' && !isRouteGroup(segment));

  return pathSegments.length === 0 ? '/' : `/${pathSegments.join('/')}`;
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function indentJsx(value: string, indent: string): string {
  return value
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

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

function buildTabsScreenFallbackJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const hideHrefOption = route.hideInTabBar ? 'href: null,' : '';
  const hideTabBarOption = route.hideInTabBar ? "tabBarStyle: { display: 'none' }," : '';
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const iconFunctionName = buildScreenIconFunctionName(route, index);
  const optionLines = [
    `title: '${label}',`,
    `tabBarLabel: '${label}',`,
    route.icon ? `tabBarIcon: ${iconFunctionName},` : '',
    hideHrefOption,
    hideTabBarOption,
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
    jsx: `      <Tabs.Screen key="${route.name}" name="${route.name}" options={${optionsConstName}} />`,
  };
}

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

function buildDrawerScreenFallbackJsx(
  route: RouteDefinition,
  manifest: AppManifest,
  index: number,
): { declaration: string; jsx: string } {
  const label = resolveRouteLabel(route, manifest);
  const hideDrawerOption = route.hideInTabBar ? "drawerItemStyle: { display: 'none' }," : '';
  const disableHiddenRouteOption = route.hideInTabBar
    ? 'swipeEnabled: false, headerShown: false,'
    : '';
  const optionsConstName = buildScreenOptionsConstName(route, index);
  const iconFunctionName = buildScreenIconFunctionName(route, index);
  const optionLines = [
    `title: '${label}',`,
    `drawerLabel: '${label}',`,
    route.icon ? `drawerIcon: ${iconFunctionName},` : '',
    hideDrawerOption,
    disableHiddenRouteOption,
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

function resolveRouteLabel(route: RouteDefinition, manifest: AppManifest): string {
  const screen = route.screenId ? manifest.screens[route.screenId] : undefined;
  return escapeStringLiteral(route.label ?? screen?.title ?? screen?.name ?? route.name);
}

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

function buildRouteIconLiteral(icon: NonNullable<RouteDefinition['icon']>): string {
  const provider = icon.provider ? `, provider: '${escapeStringLiteral(icon.provider)}'` : '';
  const size =
    icon.size === undefined
      ? ''
      : `, size: ${typeof icon.size === 'number' ? icon.size : `'${escapeStringLiteral(String(icon.size))}'`}`;
  const color = icon.color ? `, color: '${escapeStringLiteral(icon.color)}'` : '';

  return `{ name: '${escapeStringLiteral(icon.name)}'${provider}${size}${color} }`;
}

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

function buildScreenIconFunctionName(route: RouteDefinition, index: number): string {
  return buildScreenOptionsConstName(route, index).replace(/ScreenOptions$/, 'Icon');
}
