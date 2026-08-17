import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path: string, before: string, after: string): void {
  const source = readFileSync(path, 'utf8');
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path}: expected one occurrence, found ${occurrences}: ${before}`);
  }
  writeFileSync(path, source.replace(before, after));
}

function replaceExactCount(path: string, before: string, after: string, count: number): void {
  const source = readFileSync(path, 'utf8');
  const occurrences = source.split(before).length - 1;
  if (occurrences !== count) {
    throw new Error(`${path}: expected ${count} occurrences, found ${occurrences}: ${before}`);
  }
  writeFileSync(path, source.replaceAll(before, after));
}

const generatedAdmin = 'src/host/generatedAdminExpoWeb.smoke.test.ts';
replaceOnce(
  generatedAdmin,
  '  const catalogScreen = nutritionManifest.screens[catalogScreenId];',
  `  const catalogScreen = Object.values(nutritionManifest.screens).find(\n    (screen) => screen.id === catalogScreenId,\n  );`,
);
replaceOnce(
  generatedAdmin,
  '    const actualRect = actual.rects[testID];',
  `    const actualRect = Object.entries(actual.rects).find(([key]) => key === testID)?.[1];`,
);
replaceOnce(
  generatedAdmin,
  '    const previous = snapshot.actions[index - 1];',
  '    const previous = snapshot.actions.at(index - 1);',
);
replaceOnce(
  generatedAdmin,
  '    const current = snapshot.actions[index];',
  '    const current = snapshot.actions.at(index);',
);
replaceOnce(
  generatedAdmin,
  '  const value = env[name];',
  `  const value = Object.entries(env).find(([key]) => key === name)?.[1];`,
);

const generatedAuth = 'src/host/generatedAuthAdapterRuntime.smoke.test.ts';
replaceOnce(
  generatedAuth,
  '  const value = env[name];',
  `  const value = Object.entries(env).find(([key]) => key === name)?.[1];`,
);

const infraE2e = 'src/host/studioInfra.e2e.test.ts';
replaceOnce(infraE2e, '      const app = ports[offset];', '      const app = ports.at(offset);');
replaceOnce(
  infraE2e,
  '      const gateway = ports[offset + 1];',
  '      const gateway = ports.at(offset + 1);',
);
replaceOnce(
  infraE2e,
  '      const studio = ports[offset + 2];',
  '      const studio = ports.at(offset + 2);',
);
replaceOnce(infraE2e, '      const db = ports[offset + 3];', '      const db = ports.at(offset + 3);');

const indexPath = 'src/index.ts';
replaceOnce(
  indexPath,
  '  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);',
  '  const hasChanged = nextChildren.some((child, index) => child !== root.children?.at(index));',
);
replaceOnce(
  indexPath,
  '    const removedNode = children[directIndex];',
  '    const removedNode = children.at(directIndex);',
);
replaceOnce(
  indexPath,
  '  const meta = componentMeta[parentType];',
  `  const meta = Object.entries(componentMeta).find(([type]) => type === parentType)?.[1];`,
);
replaceOnce(
  indexPath,
  '  return CATEGORY_LABELS[category] ?? category;',
  `  return Object.entries(CATEGORY_LABELS).find(([key]) => key === category)?.[1] ?? category;`,
);

const manifestState = 'src/manifestState.ts';
replaceOnce(
  manifestState,
  '  return manifest.screens[screenId];',
  `  return Object.values(manifest.screens).find((screen) => screen.id === screenId);`,
);
replaceOnce(
  manifestState,
  '  return first.length === second.length && first.every((value, index) => value === second[index]);',
  '  return first.length === second.length && first.every((value, index) => value === second.at(index));',
);
replaceOnce(
  manifestState,
  '  while (manifest.screens[screenId] || existingScreenIds.has(screenId)) {',
  '  while (Object.hasOwn(manifest.screens, screenId) || existingScreenIds.has(screenId)) {',
);
replaceOnce(
  manifestState,
  '  const deletedScreen = manifest.screens[screenId];',
  '  const deletedScreen = resolveCanonicalStudioScreen(manifest, screenId);',
);
replaceOnce(
  manifestState,
  '  const { [screenId]: _deletedScreen, ...remainingScreens } = manifest.screens;',
  `  const remainingScreens = Object.fromEntries(\n    Object.entries(manifest.screens).filter(([registryKey]) => registryKey !== screenId),\n  );`,
);
replaceOnce(
  manifestState,
  '    (id) => !!remainingScreens[id],',
  '    (id) => Object.hasOwn(remainingScreens, id),',
);
replaceOnce(
  manifestState,
  '    !activeScreenId || activeScreenId === screenId || !remainingScreens[activeScreenId]',
  '    !activeScreenId || activeScreenId === screenId || !Object.hasOwn(remainingScreens, activeScreenId)',
);
replaceExactCount(
  manifestState,
  'child !== root.children?.[index]',
  'child !== root.children?.at(index)',
  2,
);

const stationarySelection = 'src/runtime/stationarySelection.ts';
replaceOnce(
  stationarySelection,
  '    const candidate = right[index];',
  '    const candidate = right.at(index);',
);

console.log('Applied API5 object-access codemod.');
