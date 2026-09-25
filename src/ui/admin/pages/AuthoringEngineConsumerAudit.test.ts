import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(sourceRoot, relativePath), 'utf8');
}

test('keeps generic authoring initialization and mutation interpretation inside the central engine', () => {
  const bindingDefault = readSource('ui/admin/pages/bindings/createBindingLiteralDefaultValue.ts');
  const properties = readSource('ui/admin/pages/PropertiesAdminPage.tsx');
  const themeRecipe = readSource('ui/admin/pages/ThemeRecipeAdminPage.tsx');

  expect(bindingDefault).toContain('createInitialAuthoringValue(field.authoring)');
  expect(bindingDefault).not.toContain('switch (structure.kind)');

  for (const consumer of [properties, themeRecipe]) {
    expect(consumer).toContain('applyAuthoringMutation');
    expect(consumer).not.toContain('mutation.kind ===');
    expect(consumer).not.toContain('mutation.path.length');
  }
});

test('keeps binding compatibility metadata projected from the canonical DataSchema authoring adapter', () => {
  const schemaProjection = readSource('bindingSchemaModel.ts');

  expect(schemaProjection).toContain('resolveDataSchemaAuthoringStructure');
  expect(schemaProjection).not.toContain('resolveSingleSchemaType');
  expect(schemaProjection).not.toContain('function resolveSchemaType');
});
