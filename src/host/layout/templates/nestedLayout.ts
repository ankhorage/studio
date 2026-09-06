import type { NavigatorNode } from '@ankhorage/contracts';

import type { BuiltNavigatorJsx } from './navigation';
import { joinNonEmptyLines } from './utils/strings';

/*** Generate a nested Expo Router layout around one already-built navigator source fragment. */
export function getNestedLayoutTsx(args: { node: NavigatorNode; navigator: BuiltNavigatorJsx }) {
  const { node, navigator } = args;
  const themeHook = navigator.usesTheme ? '  const { theme } = useZoraTheme();\n' : '';
  const moduleDeclarations = navigator.usesTheme ? '' : navigator.declarations;
  const scopedDeclarations = navigator.usesTheme
    ? navigator.declarations
        .split('\n')
        .map((line) => (line.length > 0 ? `  ${line}` : line))
        .join('\n')
    : '';

  const imports = joinNonEmptyLines([
    navigator.usesZoraNavigationRouteMap
      ? `import type { ZoraNavigationRouteMap } from '@ankhorage/zora';`
      : '',
    navigator.usesTheme ||
    navigator.usesIcon ||
    navigator.usesZoraTabBar ||
    navigator.usesZoraDrawerContent
      ? `import { ${[
          navigator.usesIcon ? 'Icon' : '',
          navigator.usesTheme ? 'useZoraTheme' : '',
          navigator.usesZoraTabBar ? 'ZoraTabBar' : '',
          navigator.usesZoraDrawerContent ? 'ZoraDrawerContent' : '',
        ]
          .filter(Boolean)
          .join(', ')} } from '@ankhorage/zora';`
      : '',
    navigator.usesZoraTabBar ? `import type { BottomTabBarProps } from 'expo-router/js-tabs';` : '',
    navigator.usesZoraDrawerContent
      ? `import type { DrawerContentComponentProps } from 'expo-router/drawer';`
      : '',
    node.type === 'drawer'
      ? `import { Drawer } from 'expo-router/drawer';`
      : node.type === 'tabs'
        ? `import { Tabs } from 'expo-router/js-tabs';`
        : `import { Stack } from 'expo-router';`,
  ]);

  return `${imports}

export const unstable_settings = {
  initialRouteName: '${resolveGeneratedInitialRouteName(node)}',
};

${moduleDeclarations}

export default function Layout() {
${themeHook}${scopedDeclarations ? `${scopedDeclarations}\n` : ''}  return (
    ${navigator.jsx}
  );
}
`;
}

/*** Resolve a valid generated initial route from a navigator, falling back to its first route or index. */
function resolveGeneratedInitialRouteName(node: NavigatorNode): string {
  const routeNames = new Set(node.routes.map((route) => route.name));

  if (node.initialRouteName && routeNames.has(node.initialRouteName)) {
    return node.initialRouteName;
  }

  return node.routes[0]?.name ?? 'index';
}
