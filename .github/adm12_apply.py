from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    target.write_text(text.replace(old, new, 1))


def replace_exact_count(path: str, old: str, new: str, expected: int) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} exact matches, found {count}')
    target.write_text(text.replace(old, new))


def sub_once(path: str, pattern: str, replacement: str) -> None:
    target = Path(path)
    text = target.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match, found {count}')
    target.write_text(updated)


replace_once('package.json', '"@ankhorage/zora": "^2.9.3"', '"@ankhorage/zora": "^2.10.0"')

index_path = 'src/index.ts'
for old in (
    "export type StudioMode = 'light' | 'dark';\n",
    '  studioMode: StudioMode;\n',
    "  | { type: 'studio.setStudioMode'; mode: StudioMode }\n",
    '  setActiveThemeMode: (mode: StudioMode) => void;\n',
    '  setStudioMode: (mode: StudioMode) => void;\n',
):
    replace_once(index_path, old, '')

provider_path = 'src/core/StudioProvider.ts'
for old in (
    '  type StudioMode,\n',
    "  const [studioMode, setStudioMode] = useState<StudioMode>('dark');\n",
    '      setActiveThemeMode: setStudioMode,\n',
    '      setStudioMode,\n',
):
    replace_once(provider_path, old, '')
replace_exact_count(provider_path, '      studioMode,\n', '', 2)

manifest_path = 'src/manifestState.ts'
replace_once(manifest_path, '  StudioMode,\n', '')
replace_once(
    manifest_path,
    '  activeThemeMode: StudioMode,\n',
    "  activeThemeMode: NonNullable<StudioManifest['activeThemeMode']>,\n",
)

augmentation_path = 'src/ui/useStudioAppBarAugmentation.ts'
replace_once(augmentation_path, '  appMode?: unknown;\n', '')
replace_once(augmentation_path, '  overflow?: unknown;\n', '')

layout_path = 'src/host/layout/layoutGenerator.ts'
replace_once(
    layout_path,
    "`import type { AppManifest${includeStudio ? ', NavigatorSpec, RouteDefinition' : ''} } from '@ankhorage/contracts';`,",
    "`import type { AppManifest } from '@ankhorage/contracts';`,",
)
replace_once(
    layout_path,
    "        includeStudio ? 'AppBar' : '',\n",
    "        'AppBar',\n        'ThemeModeToggle',\n",
)
replace_once(
    layout_path,
    "      includeStudio\n        ? `import { resolveScreenIdForPathname } from '@ankhorage/studio/routeUtils';`\n        : '',\n",
    '',
)
replace_once(
    layout_path,
    "      `import type { AppManifest${includeStudio ? ', NavigatorSpec, RouteDefinition' : ''} } from '@ankhorage/contracts';`,",
    "      `import type { AppManifest } from '@ankhorage/contracts';`,",
)
replace_once(
    layout_path,
    "        includeStudio ? 'AppBar' : '',\n",
    "        'AppBar',\n        'ThemeModeToggle',\n",
)
replace_once(
    layout_path,
    "      rootNavigator.type === 'tabs'\n        ? `import { Tabs${includeStudio ? ', useGlobalSearchParams, usePathname' : ''} } from 'expo-router';`\n        : rootNavigator.type === 'drawer'\n          ? `${includeStudio ? `import { useGlobalSearchParams, usePathname } from 'expo-router';\\n` : ''}import { Drawer } from 'expo-router/drawer';`\n          : `import { Stack${includeStudio ? ', useGlobalSearchParams, usePathname' : ''} } from 'expo-router';`,",
    "      rootNavigator.type === 'tabs'\n        ? `import { Tabs, usePathname${includeStudio ? ', useGlobalSearchParams' : ''} } from 'expo-router';`\n        : rootNavigator.type === 'drawer'\n          ? `import { usePathname${includeStudio ? ', useGlobalSearchParams' : ''} } from 'expo-router';\\nimport { Drawer } from 'expo-router/drawer';`\n          : `import { Stack, usePathname${includeStudio ? ', useGlobalSearchParams' : ''} } from 'expo-router';`,",
)
replace_once(
    layout_path,
    "      includeStudio\n        ? `import { resolveScreenIdForPathname } from '@ankhorage/studio/routeUtils';`\n        : '',\n",
    '',
)

root_path = 'src/host/layout/templates/rootLayout.ts'
sub_once(
    root_path,
    r"\$\{\n  includeStudio\n    \? `\nfunction isAuthRoute\(pathname: string\): boolean \{.*?\n`\n    : ''\n\}\n",
    """function isAuthRoute(pathname: string): boolean {
  const activeTopLevelRoute = getTopLevelRoute(pathname);
  return (
    activeTopLevelRoute === AUTH_SIGN_IN_ROUTE_SEGMENT ||
    activeTopLevelRoute === AUTH_SIGN_UP_ROUTE_SEGMENT
  );
}

function shouldMountAuthenticatedAppHeader(pathname: string, isAuthRuntimeReady: boolean): boolean {
  if (isAuthRoute(pathname)) return false;
  if (!isGeneratedAuthEnforced()) return true;
  if (!isAuthRuntimeReady) return false;
  return isAuthenticated();
}
""",
)
sub_once(
    root_path,
    r"  const appHeaderHelpers = `\n.*?`;\n\n  const authRuntimeHook",
    '  const authRuntimeHook',
)
replace_once(root_path, "    includeStudio ? appHeaderHelpers.trim() : '',\n", '')
replace_once(
    root_path,
    "    : '';\n  const indentedStudioRuntimeLines =\n",
    "    : `const appPathname = ${authRuntime ? 'pathname' : 'usePathname()'};\nconst shouldMountAppHeader =\n  ${authRuntime ? 'shouldMountAuthenticatedAppHeader(appPathname, isAuthRuntimeReady)' : 'true'};`;\n  const indentedStudioRuntimeLines =\n",
)
replace_once(
    root_path,
    "  const shell = (\n    <GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>\n      <SafeAreaProvider>\n        <AppShell>\n",
    "  const appHeader = shouldMountAppHeader ? (\n    <GeneratedAppHeader appHeaderTitle={runtimeManifest.metadata.name} />\n  ) : undefined;\n  const shell = (\n    <GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>\n      <SafeAreaProvider>\n        <AppShell header={appHeader}>\n",
)
replace_once(root_path, '    activeScreenId,\n', '')
sub_once(
    root_path,
    r"   const appHeaderTitle = resolveStudioAppHeaderTitle\(\{.*?   const activeStudioTheme =\n",
    """   const studioRuntimeManifest = studioManifest ?? runtimeManifest;
   const header = shouldMountAppHeader ? (
     <StudioAugmentedAppHeader appHeaderTitle={studioRuntimeManifest.metadata.name} />
   ) : undefined;
   const activeStudioTheme =
""",
)
sub_once(
    root_path,
    r"function StudioAppHeader\(\{ appHeaderTitle \}: \{ appHeaderTitle: string \}\) \{.*?\n\}`\n",
    """function StudioAugmentedAppHeader({ appHeaderTitle }: { appHeaderTitle: string }) {
  const studioAppBar = useStudioAppBarAugmentation();

  return (
    <>
      <GeneratedAppHeader appHeaderTitle={appHeaderTitle} actions={studioAppBar.actions} />
      {studioAppBar.overlays}
    </>
  );
}`
""",
)
replace_once(
    root_path,
    'function GeneratedZoraProvider({\n',
    """function GeneratedAppHeader({
  appHeaderTitle,
  actions,
}: {
  appHeaderTitle: string;
  actions?: ReactNode;
}) {
  return (
    <AppBar
      title={appHeaderTitle}
      actions={
        <>
          <ThemeModeToggle />
          {actions}
        </>
      }
    />
  );
}

function GeneratedZoraProvider({
""",
)

test_path = 'src/host/layout/templates/rootLayout.test.ts'
replace_once(
    test_path,
    "  expect(generated).toContain(\n    'resolveScreenIdForPathname(manifest.navigator, pathname, manifest.screens)',\n  );\n",
    '',
)
replace_once(
    test_path,
    "test('keeps non-Studio generated output unchanged', () => {",
    "test('keeps generated app chrome Studio-independent when Studio is excluded', () => {",
)
replace_once(
    test_path,
    "  expect(generated).not.toContain('wrapNode: studioWrapNode');\n});\n\ntest('scopes Studio runtime selection config below StudioProvider'",
    "  expect(generated).not.toContain('wrapNode: studioWrapNode');\n  expect(generated).toContain('function GeneratedAppHeader');\n  expect(generated).toContain('<ThemeModeToggle />');\n  expect(generated).toContain('<AppShell header={appHeader}>');\n  expect(generated).not.toContain('StudioAugmentedAppHeader');\n});\n\ntest('scopes Studio runtime selection config below StudioProvider'",
)
replace_once(
    test_path,
    "  expect(generated).not.toContain('createStudioActionSuppressionConfig(previewMode)');\n});\n",
    "  expect(generated).not.toContain('createStudioActionSuppressionConfig(previewMode)');\n  expect(generated).toContain('<ThemeModeToggle />');\n  expect(generated).toContain('function GeneratedAppHeader');\n});\n",
)
replace_once(
    test_path,
    "  expect(generated).toContain('<GeneratedStatusBar />');\n});\n",
    "  expect(generated).toContain('<GeneratedStatusBar />');\n  expect(generated).toContain('function GeneratedAppHeader');\n  expect(generated).toContain('function StudioAugmentedAppHeader');\n  expect(generated).toContain('<ThemeModeToggle />');\n  expect(generated).toContain('actions={studioAppBar.actions}');\n  expect(generated).not.toContain('function StudioAppHeader');\n});\n",
)

Path('.changeset/bright-mode-chrome.md').write_text("""---
'@ankhorage/studio': minor
---

Use one canonical ZORA light/dark runtime mode across generated app chrome and Studio, render the reusable app-owned theme mode toggle in normal generated AppBars, and remove the obsolete parallel Studio mode state.
""")
