import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing expected fragment in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'src/index.ts',
  `  | 'theme-shadows'\n  | 'bindings'`,
  `  | 'theme-shadows'\n  | 'theme-component'\n  | 'theme-pattern'\n  | 'bindings'`,
);
replaceOnce(
  'src/index.ts',
  `  | \`/ankh/modules/\${string}\`\n  | \`/ankh/bindings/\${string}\``,
  `  | \`/ankh/modules/\${string}\`\n  | \`/ankh/theme/components/\${string}\`\n  | \`/ankh/theme/patterns/\${string}\`\n  | \`/ankh/bindings/\${string}\``,
);

replaceOnce(
  'src/studioAdminRouteModel.ts',
  `    | '/ankh/modules/:moduleId'\n    | '/ankh/bindings/:nodeId'`,
  `    | '/ankh/modules/:moduleId'\n    | '/ankh/theme/components/:recipeName'\n    | '/ankh/theme/patterns/:recipeName'\n    | '/ankh/bindings/:nodeId'`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  readonly contextual?: boolean;\n}`,
  `  readonly contextual?: boolean;\n  readonly showInNavigation?: boolean;\n}`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  {\n    id: 'bindings',`,
  `  {\n    id: 'theme-component',\n    path: '/ankh/theme/components/:recipeName',\n    label: 'Component recipe',\n    icon: 'cube-outline',\n    order: 46,\n    parentId: 'theme',\n    contextual: true,\n    showInNavigation: false,\n    description: 'Metadata-driven ZORA component Theme recipe.',\n  },\n  {\n    id: 'theme-pattern',\n    path: '/ankh/theme/patterns/:recipeName',\n    label: 'Pattern recipe',\n    icon: 'grid-outline',\n    order: 47,\n    parentId: 'theme',\n    contextual: true,\n    showInNavigation: false,\n    description: 'Metadata-driven ZORA pattern Theme recipe.',\n  },\n  {\n    id: 'bindings',`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `const MODULE_ROUTE_PREFIX = '/ankh/modules/';`,
  `const MODULE_ROUTE_PREFIX = '/ankh/modules/';\nconst THEME_COMPONENT_ROUTE_PREFIX = '/ankh/theme/components/';\nconst THEME_PATTERN_ROUTE_PREFIX = '/ankh/theme/patterns/';`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  if (pathname.startsWith(BINDINGS_ROUTE_PREFIX)) {`,
  `  if (pathname.startsWith(THEME_COMPONENT_ROUTE_PREFIX)) {\n    return resolveStudioThemeRecipeName(pathname) ? 'theme-component' : null;\n  }\n\n  if (pathname.startsWith(THEME_PATTERN_ROUTE_PREFIX)) {\n    return resolveStudioThemeRecipeName(pathname) ? 'theme-pattern' : null;\n  }\n\n  if (pathname.startsWith(BINDINGS_ROUTE_PREFIX)) {`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `      candidate.path !== '/ankh/modules/:moduleId' &&\n      candidate.path === pathname,`,
  `      candidate.path !== '/ankh/modules/:moduleId' &&\n      candidate.path !== '/ankh/theme/components/:recipeName' &&\n      candidate.path !== '/ankh/theme/patterns/:recipeName' &&\n      candidate.path === pathname,`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  if (routeId === 'bindings') {`,
  `  if (routeId === 'theme-component' || routeId === 'theme-pattern') {\n    const recipeName = resolveStudioThemeRecipeName(pathname);\n    if (!recipeName) return null;\n    return createStudioThemeRecipeRoutePath(\n      routeId === 'theme-component' ? 'component' : 'pattern',\n      recipeName,\n    );\n  }\n  if (routeId === 'bindings') {`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `export function createStudioBindingsRoutePath(nodeId: string): \`/ankh/bindings/\${string}\` {`,
  `export function resolveStudioThemeRecipeName(pathname: string): string | null {\n  if (pathname.startsWith(THEME_COMPONENT_ROUTE_PREFIX)) {\n    return resolveStudioDetailId(pathname, THEME_COMPONENT_ROUTE_PREFIX);\n  }\n  if (pathname.startsWith(THEME_PATTERN_ROUTE_PREFIX)) {\n    return resolveStudioDetailId(pathname, THEME_PATTERN_ROUTE_PREFIX);\n  }\n  return null;\n}\n\nexport function createStudioThemeRecipeRoutePath(\n  kind: 'component' | 'pattern',\n  recipeName: string,\n): \`/ankh/theme/components/\${string}\` | \`/ankh/theme/patterns/\${string}\` {\n  const encoded = encodeURIComponent(recipeName);\n  return kind === 'component'\n    ? \`/ankh/theme/components/\${encoded}\`\n    : \`/ankh/theme/patterns/\${encoded}\`;\n}\n\nexport function createStudioBindingsRoutePath(nodeId: string): \`/ankh/bindings/\${string}\` {`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  moduleId?: string | null;\n}): StudioAdminRoutePath | null {`,
  `  moduleId?: string | null;\n  themeRecipeName?: string | null;\n}): StudioAdminRoutePath | null {`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  if (args.routeId === 'bindings') {`,
  `  if (args.routeId === 'theme-component' || args.routeId === 'theme-pattern') {\n    return args.themeRecipeName\n      ? createStudioThemeRecipeRoutePath(\n          args.routeId === 'theme-component' ? 'component' : 'pattern',\n          args.themeRecipeName,\n        )\n      : null;\n  }\n  if (args.routeId === 'bindings') {`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  moduleId?: string | null;\n  setActivePanelId:`,
  `  moduleId?: string | null;\n  themeRecipeName?: string | null;\n  setActivePanelId:`,
);
replaceOnce(
  'src/studioAdminRouteModel.ts',
  `    moduleId: args.moduleId ?? null,\n  });`,
  `    moduleId: args.moduleId ?? null,\n    themeRecipeName: args.themeRecipeName ?? null,\n  });`,
);

replaceOnce(
  'src/ui/admin/AnkhAdminShell.tsx',
  `{STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => {`,
  `{STUDIO_ADMIN_ROUTE_REGISTRY.filter((route) => route.showInNavigation !== false).map((route) => {`,
);

replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `  createStudioScreenRoutePath,\n`,
  `  createStudioScreenRoutePath,\n  createStudioThemeRecipeRoutePath,\n`,
);
replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `  resolveStudioScreenId,\n`,
  `  resolveStudioScreenId,\n  resolveStudioThemeRecipeName,\n`,
);
replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `      'theme-shadows',\n      'bindings',`,
  `      'theme-shadows',\n      'theme-component',\n      'theme-pattern',\n      'bindings',`,
);
replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `    expect(resolveStudioAdminRouteId('/ankh/theme/shadows')).toBe('theme-shadows');\n`,
  `    expect(resolveStudioAdminRouteId('/ankh/theme/shadows')).toBe('theme-shadows');\n    const componentRecipe = createStudioThemeRecipeRoutePath('component', 'Button / primary');\n    const patternRecipe = createStudioThemeRecipeRoutePath('pattern', 'Panel');\n    expect(componentRecipe).toBe('/ankh/theme/components/Button%20%2F%20primary');\n    expect(patternRecipe).toBe('/ankh/theme/patterns/Panel');\n    expect(resolveStudioThemeRecipeName(componentRecipe)).toBe('Button / primary');\n    expect(resolveStudioThemeRecipeName(patternRecipe)).toBe('Panel');\n    expect(resolveStudioAdminRouteId(componentRecipe)).toBe('theme-component');\n    expect(resolveStudioAdminRouteId(patternRecipe)).toBe('theme-pattern');\n    expect(resolveStudioAdminRoutePath(componentRecipe)).toBe(componentRecipe);\n    expect(resolveStudioAdminRoutePath(patternRecipe)).toBe(patternRecipe);\n    expect(\n      createStudioAdminRoutePath({\n        routeId: 'theme-component',\n        themeRecipeName: 'Button / primary',\n      }),\n    ).toBe(componentRecipe);\n`,
);
