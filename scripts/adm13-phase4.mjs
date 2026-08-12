import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing expected fragment in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'src/index.ts',
  `  | 'theme'\n  | 'bindings'`,
  `  | 'theme'\n  | 'theme-colors'\n  | 'theme-typography'\n  | 'theme-spacing'\n  | 'theme-radii'\n  | 'theme-shadows'\n  | 'bindings'`,
);

replaceOnce(
  'src/index.ts',
  `  | '/ankh/secrets'\n  | '/ankh/theme';`,
  `  | '/ankh/secrets'\n  | '/ankh/theme'\n  | '/ankh/theme/colors'\n  | '/ankh/theme/typography'\n  | '/ankh/theme/spacing'\n  | '/ankh/theme/radii'\n  | '/ankh/theme/shadows';`,
);

replaceOnce(
  'src/studioAdminRouteModel.ts',
  `  {\n    id: 'theme',\n    path: '/ankh/theme',\n    label: 'Theme',\n    icon: 'color-palette-outline',\n    order: 40,\n    description: 'Active theme editing.',\n  },`,
  `  {\n    id: 'theme',\n    path: '/ankh/theme',\n    label: 'Theme',\n    icon: 'color-palette-outline',\n    order: 40,\n    description: 'Canonical project theme administration.',\n  },\n  {\n    id: 'theme-colors',\n    path: '/ankh/theme/colors',\n    label: 'Colors',\n    icon: 'color-fill-outline',\n    order: 41,\n    parentId: 'theme',\n    description: 'Mode-specific color source and harmony.',\n  },\n  {\n    id: 'theme-typography',\n    path: '/ankh/theme/typography',\n    label: 'Typography',\n    icon: 'text-outline',\n    order: 42,\n    parentId: 'theme',\n    description: 'Global heading, size, and weight tokens.',\n  },\n  {\n    id: 'theme-spacing',\n    path: '/ankh/theme/spacing',\n    label: 'Spacing',\n    icon: 'resize-outline',\n    order: 43,\n    parentId: 'theme',\n    description: 'Global spacing tokens.',\n  },\n  {\n    id: 'theme-radii',\n    path: '/ankh/theme/radii',\n    label: 'Radii',\n    icon: 'radio-button-off-outline',\n    order: 44,\n    parentId: 'theme',\n    description: 'Global radius tokens.',\n  },\n  {\n    id: 'theme-shadows',\n    path: '/ankh/theme/shadows',\n    label: 'Shadows',\n    icon: 'layers-outline',\n    order: 45,\n    parentId: 'theme',\n    description: 'Global shadow tokens.',\n  },`,
);

replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `      'theme',\n      'bindings',`,
  `      'theme',\n      'theme-colors',\n      'theme-typography',\n      'theme-spacing',\n      'theme-radii',\n      'theme-shadows',\n      'bindings',`,
);

replaceOnce(
  'src/studioAdminRouteModel.test.ts',
  `    expect(resolveStudioAdminRouteId('/ankh/theme')).toBe('theme');\n`,
  `    expect(resolveStudioAdminRouteId('/ankh/theme')).toBe('theme');\n    expect(resolveStudioAdminRouteId('/ankh/theme/colors')).toBe('theme-colors');\n    expect(resolveStudioAdminRouteId('/ankh/theme/typography')).toBe('theme-typography');\n    expect(resolveStudioAdminRouteId('/ankh/theme/spacing')).toBe('theme-spacing');\n    expect(resolveStudioAdminRouteId('/ankh/theme/radii')).toBe('theme-radii');\n    expect(resolveStudioAdminRouteId('/ankh/theme/shadows')).toBe('theme-shadows');\n    expect(\n      isStudioAdminRouteActive({ currentRouteId: 'theme-spacing', candidateRouteId: 'theme' }),\n    ).toBe(true);\n`,
);
