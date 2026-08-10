from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old!r}")
    target.write_text(text.replace(old, new, 1))


replace_one(
    "src/index.ts",
    "export * from './propertiesAuthoringModel';",
    "export * from './bindingAuthoringModel';\nexport * from './propertiesAuthoringModel';",
)
replace_one(
    "src/index.ts",
    "  | 'theme'\n  | 'properties';",
    "  | 'theme'\n  | 'bindings'\n  | 'properties';",
)
replace_one(
    "src/index.ts",
    "export type StudioAdminRoutePath = StudioAdminStaticRoutePath | `/ankh/properties/${string}`;",
    "export type StudioAdminRoutePath =\n  | StudioAdminStaticRoutePath\n  | `/ankh/bindings/${string}`\n  | `/ankh/properties/${string}`;",
)
replace_one(
    "src/index.ts",
    "  'createStudioInstancePropertyPatch',\n  'ProjectAuthHealth',",
    "  'createStudioInstancePropertyPatch',\n  'resolveStudioBindableProps',\n  'resolveStudioBindableEvents',\n  'collectStudioBindingOperationOptions',\n  'ProjectAuthHealth',",
)

route_path = Path("src/studioAdminRouteModel.ts")
route = route_path.read_text()
route = route.replace(
    "  readonly propertiesNodeId: string | null;",
    "  readonly bindingsNodeId: string | null;\n  readonly propertiesNodeId: string | null;",
    1,
)
route = route.replace(
    "  readonly path: StudioAdminStaticRoutePath | '/ankh/properties/:nodeId';",
    "  readonly path:\n    | StudioAdminStaticRoutePath\n    | '/ankh/bindings/:nodeId'\n    | '/ankh/properties/:nodeId';",
    1,
)
route = route.replace(
    "  {\n    id: 'properties',\n    path: '/ankh/properties/:nodeId',",
    "  {\n    id: 'bindings',\n    path: '/ankh/bindings/:nodeId',\n    label: 'Bindings',\n    icon: 'git-branch-outline',\n    order: 50,\n    contextual: true,\n    description: 'Selected node property/data and event/action bindings.',\n  },\n  {\n    id: 'properties',\n    path: '/ankh/properties/:nodeId',",
    1,
)
route = route.replace(
    "    order: 50,\n    contextual: true,\n    description: 'Selected node properties.',",
    "    order: 51,\n    contextual: true,\n    description: 'Selected node properties.',",
    1,
)
route = route.replace(
    "const PROPERTIES_ROUTE_PREFIX = '/ankh/properties/';",
    "const BINDINGS_ROUTE_PREFIX = '/ankh/bindings/';\nconst PROPERTIES_ROUTE_PREFIX = '/ankh/properties/';",
    1,
)
route = route.replace(
    "export function resolveStudioAdminRouteId(pathname: string): StudioAdminRouteId | null {\n  if (pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {",
    "export function resolveStudioAdminRouteId(pathname: string): StudioAdminRouteId | null {\n  if (pathname.startsWith(BINDINGS_ROUTE_PREFIX)) {\n    return resolveStudioBindingsNodeId(pathname) ? 'bindings' : null;\n  }\n\n  if (pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {",
    1,
)
route = route.replace(
    "  if (routeId === 'properties') {\n    const nodeId = resolveStudioPropertiesNodeId(pathname);\n    return nodeId ? createStudioPropertiesRoutePath(nodeId) : null;\n  }",
    "  if (routeId === 'bindings') {\n    const nodeId = resolveStudioBindingsNodeId(pathname);\n    return nodeId ? createStudioBindingsRoutePath(nodeId) : null;\n  }\n  if (routeId === 'properties') {\n    const nodeId = resolveStudioPropertiesNodeId(pathname);\n    return nodeId ? createStudioPropertiesRoutePath(nodeId) : null;\n  }",
    1,
)
marker = "export function resolveStudioPropertiesNodeId(pathname: string): string | null {"
binding_helpers = """export function resolveStudioBindingsNodeId(pathname: string): string | null {
  return resolveStudioContextNodeId(pathname, BINDINGS_ROUTE_PREFIX);
}

export function createStudioBindingsRoutePath(nodeId: string): `/ankh/bindings/${string}` {
  return `/ankh/bindings/${encodeURIComponent(nodeId)}`;
}

"""
route = route.replace(marker, binding_helpers + marker, 1)
route = route.replace(
    "export function resolveStudioPropertiesNodeId(pathname: string): string | null {\n  if (!pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {\n    return null;\n  }\n\n  const [encodedNodeId] = pathname.slice(PROPERTIES_ROUTE_PREFIX.length).split('/');\n  if (!encodedNodeId) {\n    return null;\n  }\n\n  try {\n    return decodeURIComponent(encodedNodeId);\n  } catch {\n    return encodedNodeId;\n  }\n}",
    "export function resolveStudioPropertiesNodeId(pathname: string): string | null {\n  return resolveStudioContextNodeId(pathname, PROPERTIES_ROUTE_PREFIX);\n}",
    1,
)
route = route.replace(
    "export function createStudioAdminRoutePath(args: {\n  routeId: StudioAdminRouteId;\n  selectedNodeId?: string | null;\n}): StudioAdminRoutePath | null {\n  if (args.routeId === 'properties') {",
    "export function createStudioAdminRoutePath(args: {\n  routeId: StudioAdminRouteId;\n  selectedNodeId?: string | null;\n}): StudioAdminRoutePath | null {\n  if (args.routeId === 'bindings') {\n    return args.selectedNodeId ? createStudioBindingsRoutePath(args.selectedNodeId) : null;\n  }\n  if (args.routeId === 'properties') {",
    1,
)
route = route.replace(
    "  if (routeId === 'properties') {\n    return context.selectedNodeId !== null;\n  }",
    "  if (routeId === 'bindings' || routeId === 'properties') {\n    return context.selectedNodeId !== null;\n  }",
    1,
)
route = route.replace(
    "    propertiesNodeId: resolveStudioPropertiesNodeId(args.pathname),",
    "    bindingsNodeId: resolveStudioBindingsNodeId(args.pathname),\n    propertiesNodeId: resolveStudioPropertiesNodeId(args.pathname),",
    1,
)
route += """

function resolveStudioContextNodeId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const [encodedNodeId] = pathname.slice(prefix.length).split('/');
  if (!encodedNodeId) return null;
  try {
    return decodeURIComponent(encodedNodeId);
  } catch {
    return encodedNodeId;
  }
}
"""
route_path.write_text(route)

replace_one(
    "src/ui/studioAppBarModel.ts",
    "  readonly id: 'properties' | 'selectParent' | 'clearSelection';",
    "  readonly id: 'properties' | 'bindings' | 'selectParent' | 'clearSelection';",
)
replace_one(
    "src/ui/studioAppBarModel.ts",
    "  const actions: StudioAppBarContextAction[] = [{ id: 'properties', label: 'Properties' }];",
    "  const actions: StudioAppBarContextAction[] = [\n    { id: 'properties', label: 'Properties' },\n    { id: 'bindings', label: 'Bindings' },\n  ];",
)

appbar_path = Path("src/ui/useStudioAppBarAugmentation.ts")
appbar = appbar_path.read_text()
appbar = appbar.replace(
    "  createStudioPropertiesRoutePath,",
    "  createStudioBindingsRoutePath,\n  createStudioPropertiesRoutePath,",
    1,
)
appbar = appbar.replace(
    "  const openProperties = useCallback(() => {",
    "  const openBindings = useCallback(() => {\n    if (!selection.selectedNodeId) return;\n    router.push(createStudioBindingsRoutePath(selection.selectedNodeId));\n  }, [router, selection.selectedNodeId]);\n\n  const openProperties = useCallback(() => {",
    1,
)
appbar = appbar.replace(
    "            action.id === 'properties'\n              ? openProperties\n              : action.id === 'selectParent'",
    "            action.id === 'properties'\n              ? openProperties\n              : action.id === 'bindings'\n                ? openBindings\n                : action.id === 'selectParent'",
    1,
)
appbar = appbar.replace(
    "              action.id === 'properties'\n                ? { name: 'options-outline' }\n                : action.id === 'selectParent'",
    "              action.id === 'properties'\n                ? { name: 'options-outline' }\n                : action.id === 'bindings'\n                  ? { name: 'git-branch-outline' }\n                  : action.id === 'selectParent'",
    1,
)
appbar_path.write_text(appbar)

admin_path = Path("src/ui/admin/AnkhAdminPage.tsx")
admin = admin_path.read_text()
admin = admin.replace(
    "import { resolveStudioPropertiesNodeId } from '../../studioAdminRouteModel';",
    "import {\n  resolveStudioBindingsNodeId,\n  resolveStudioPropertiesNodeId,\n} from '../../studioAdminRouteModel';",
    1,
)
admin = admin.replace(
    "import { OverviewAdminPage } from './pages/OverviewAdminPage';",
    "import { BindingsAdminPage } from './pages/BindingsAdminPage';\nimport { OverviewAdminPage } from './pages/OverviewAdminPage';",
    1,
)
admin = admin.replace(
    "  theme: () => <ThemeAdminPage />,\n  properties:",
    "  theme: () => <ThemeAdminPage />,\n  bindings: ({ pathname }) => (\n    <BindingsAdminPage nodeId={resolveStudioBindingsNodeId(pathname)} />\n  ),\n  properties:",
    1,
)
admin_path.write_text(admin)

package_path = Path("package.json")
package_text = package_path.read_text()
package_text = package_text.replace(
    '    "./propertiesAuthoringModel": {',
    '    "./bindingAuthoringModel": {\n      "types": "./dist/bindingAuthoringModel.d.ts",\n      "import": "./dist/bindingAuthoringModel.js"\n    },\n    "./propertiesAuthoringModel": {',
    1,
)
package_path.write_text(package_text)

Path(".github/workflows/validate-adm6.yml").unlink(missing_ok=True)
Path(".github/workflows/wire-adm6.yml").unlink(missing_ok=True)
Path(".github/scripts/wire_adm6.py").unlink(missing_ok=True)
