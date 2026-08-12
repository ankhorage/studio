import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Expected source fragment not found in ${path}`);
  }
  writeFileSync(path, source.replace(before, after));
}

const packagePath = 'package.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.dependencies['@ankhorage/zora'] = '^2.12.0';
packageJson.devDependencies['@ankhorage/paradox'] = '^0.1.21';
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

replaceOnce(
  'src/manifestState.ts',
  `      return {\n        ...theme,\n        ...(updates.name ? { name: updates.name } : {}),\n        ...(updates.light ? { light: { ...theme.light, ...updates.light } } : {}),\n        ...(updates.dark ? { dark: { ...theme.dark, ...updates.dark } } : {}),\n      };`,
  `      const { light, dark, ...sharedUpdates } = updates;\n      return {\n        ...theme,\n        ...sharedUpdates,\n        ...(light ? { light: { ...theme.light, ...light } } : {}),\n        ...(dark ? { dark: { ...theme.dark, ...dark } } : {}),\n      };`,
);

replaceOnce(
  'src/host/layout/templates/rootLayout.ts',
  `function resolveZoraSurfaceThemeConfig(theme: AppManifest['themes'][number]) {\n  return {\n    id: theme.id,\n    name: theme.name,\n    light: { ...theme.light },\n    dark: { ...theme.dark },\n  };\n}`,
  `function resolveZoraSurfaceThemeConfig(theme: AppManifest['themes'][number]) {\n  return {\n    ...theme,\n    light: { ...theme.light },\n    dark: { ...theme.dark },\n  };\n}`,
);

const manifestTest = `\n\ntest('updates canonical global tokens and recipe overrides without dropping mode source', () => {\n  const manifest = createManifest();\n  const updated = updateStudioManifestTheme(manifest, 'theme-1', {\n    tokens: {\n      spacing: { compact: 6 },\n      radii: { card: 12 },\n      shadows: { raised: 8 },\n    },\n    recipes: {\n      components: { Button: { size: 'l' } },\n      patterns: { Panel: { padding: 'compact' } },\n    },\n  });\n\n  expect(updated.themes[0]).toMatchObject({\n    light: manifest.themes[0]?.light,\n    dark: manifest.themes[0]?.dark,\n    tokens: { spacing: { compact: 6 }, radii: { card: 12 }, shadows: { raised: 8 } },\n    recipes: {\n      components: { Button: { size: 'l' } },\n      patterns: { Panel: { padding: 'compact' } },\n    },\n  });\n});\n`;
const manifestTestPath = 'src/manifestState.test.ts';
const manifestTestSource = readFileSync(manifestTestPath, 'utf8');
if (!manifestTestSource.includes("updates canonical global tokens and recipe overrides")) {
  writeFileSync(manifestTestPath, `${manifestTestSource.trimEnd()}${manifestTest}`);
}

replaceOnce(
  'src/host/layout/templates/rootLayout.test.ts',
  `  expect(generated).toContain('function GeneratedZoraThemeConfigSync');\n`,
  `  expect(generated).toContain('function GeneratedZoraThemeConfigSync');\n  expect(generated).toContain('...theme,');\n`,
);
