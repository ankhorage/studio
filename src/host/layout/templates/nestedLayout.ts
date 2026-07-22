import type { NavigatorSpec } from '@ankhorage/contracts';

import type { BuiltNavigatorJsx } from './navigation';
import { joinNonEmptyLines } from './utils/strings';

export function getNestedLayoutTsx(args: { node: NavigatorSpec; navigator: BuiltNavigatorJsx }) {
  const { node, navigator } = args;
  const themeHook = navigator.usesTheme ? '  const { theme } = useZoraTheme();\n' : '';
  const authStateHook = navigator.usesGeneratedAuthNavigationState
    ? '  const authState = useGeneratedAuthNavigationState();\n'
    : '';
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
    navigator.usesZoraTabBar
      ? `import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';`
      : '',
    navigator.usesZoraDrawerContent
      ? `import type { DrawerContentComponentProps } from '@react-navigation/drawer';`
      : '',
    navigator.usesGeneratedAuthNavigationState
      ? `import { useGeneratedAuthNavigationState } from '@/auth/navigation';`
      : '',
    node.type === 'drawer'
      ? `import { Drawer } from 'expo-router/drawer';`
      : node.type === 'tabs'
        ? `import { Tabs } from 'expo-router';`
        : `import { Stack } from 'expo-router';`,
  ]);

  return `${imports}

export const unstable_settings = {
  initialRouteName: '${resolveGeneratedInitialRouteName(node)}',
};

${moduleDeclarations}

export default function Layout() {
${themeHook}${authStateHook}${scopedDeclarations ? `${scopedDeclarations}\n` : ''}  return (
    ${navigator.jsx}
  );
}
`;
}

function resolveGeneratedInitialRouteName(node: NavigatorSpec): string {
  const routeNames = new Set(node.routes.map((route) => route.name));

  if (node.initialRouteName && routeNames.has(node.initialRouteName)) {
    return node.initialRouteName;
  }

  return node.routes[0]?.name ?? 'index';
}
