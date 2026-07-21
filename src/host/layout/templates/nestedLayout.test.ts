import type { NavigatorSpec } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import type { BuiltNavigatorJsx } from './navigation';
import { getNestedLayoutTsx } from './nestedLayout';

const NODE: NavigatorSpec = {
  type: 'tabs',
  routes: [{ name: 'index', screenId: 'index' }],
};

function createNavigator(usesTheme: boolean): BuiltNavigatorJsx {
  return {
    declarations: usesTheme
      ? 'const tabsNavigatorScreenOptions = { color: theme.colors.primary };'
      : 'const tabsNavigatorScreenOptions = { headerShown: false };',
    jsx: '<Tabs screenOptions={tabsNavigatorScreenOptions} />',
    usesTheme,
    usesIcon: false,
    usesZoraTabBar: false,
    usesZoraDrawerContent: false,
    usesZoraNavigationRouteMap: false,
  };
}

test('scopes theme-dependent navigator declarations inside the layout component', () => {
  const output = getNestedLayoutTsx({ node: NODE, navigator: createNavigator(true) });
  const componentStart = output.indexOf('export default function Layout()');
  const themeHook = output.indexOf('const { theme } = useZoraTheme();');
  const optionsDeclaration = output.indexOf('const tabsNavigatorScreenOptions');

  expect(componentStart).toBeGreaterThan(-1);
  expect(themeHook).toBeGreaterThan(componentStart);
  expect(optionsDeclaration).toBeGreaterThan(themeHook);
  expect(output.slice(0, componentStart)).not.toContain('theme.colors.primary');
});

test('keeps theme-independent navigator declarations at module scope', () => {
  const output = getNestedLayoutTsx({ node: NODE, navigator: createNavigator(false) });
  const componentStart = output.indexOf('export default function Layout()');
  const optionsDeclaration = output.indexOf('const tabsNavigatorScreenOptions');

  expect(optionsDeclaration).toBeGreaterThan(-1);
  expect(optionsDeclaration).toBeLessThan(componentStart);
  expect(output).not.toContain('useZoraTheme');
});
