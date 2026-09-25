import type { ZoraThemeRecipeMeta } from '@ankhorage/zora/metadata';
import { ZORA_THEME_RECIPE_META } from '@ankhorage/zora/metadata';
import { expect, test } from 'bun:test';

import { applyAuthoringMutation } from '../../application/use-cases/applyAuthoringMutation';
import { updateThemeRecipeOverrides } from '../../../../ui/admin/pages/themeRecipeAuthoringModel';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';
import { resolveZoraThemeRecipeAuthoring } from './resolveZoraThemeRecipeAuthoring';

test('derives every released ZORA recipe without local field definitions or authored defaults', () => {
  for (const meta of Object.values(ZORA_THEME_RECIPE_META)) {
    const model = deriveAuthoringModel({
      ...resolveZoraThemeRecipeAuthoring(meta, () => ['s', 'm', 'l']),
      value: undefined,
    });
    expect(model.kind).toBe('object');
    if (model.kind !== 'object') throw new Error('Expected a recipe object.');
    expect(model.fields).toHaveLength(Object.keys(meta.fields).length);
    expect(model.fields.every((field) => field.kind !== 'unsupported')).toBe(true);
    for (const field of model.fields) {
      expect(field.optional).toBe(true);
      expect(field.inheritance?.overridden).toBe(false);
      if (field.kind === 'scalar' || field.kind === 'choice') expect(field.value).toBeUndefined();
    }
  }
});

test('takes token choices and their family from the owner instead of guessing from field names', () => {
  const requested: string[] = [];
  const model = deriveAuthoringModel({
    ...resolveZoraThemeRecipeAuthoring(cardMetadata(), (family) => {
      requested.push(family);
      return [`custom-${family}`];
    }),
    value: { padding: 'custom-spacing' },
  });
  expect(requested).toEqual(['spacing', 'radii']);
  if (model.kind !== 'object') throw new Error('Expected a recipe object.');
  expect(model.fields.find((field) => field.path[0] === 'padding')).toMatchObject({
    kind: 'choice',
    path: ['padding'],
    values: ['custom-spacing'],
    value: 'custom-spacing',
    label: 'Padding',
    description: cardMetadata().fields.padding?.description,
    optional: true,
    readOnly: false,
    inheritance: { overridden: true },
  });
});

test('distinguishes inherited false, explicit false and explicit true without copying defaults', () => {
  const authoring = resolveZoraThemeRecipeAuthoring(cardMetadata(), () => ['s', 'm', 'l']);
  for (const overrides of [{}, { compact: false }, { compact: true }]) {
    const model = deriveAuthoringModel({ ...authoring, value: overrides });
    expect(model.kind).toBe('object');
    if (model.kind !== 'object') throw new Error('Expected a recipe object.');
    expect(model.fields.find((field) => field.path[0] === 'compact')).toMatchObject({
      kind: 'scalar',
      scalarType: 'boolean',
      value: overrides.compact,
      inheritance: { value: false, overridden: overrides.compact !== undefined },
    });
  }
});

test('keeps invalid overrides visible and resettable while preserving unrelated authored values', () => {
  const meta = cardMetadata();
  const authoring = resolveZoraThemeRecipeAuthoring(meta, () => ['s', 'm', 'l']);
  const recipes = { components: { Card: { tone: 'removed-choice', unrelated: 'keep' } } };
  const invalid = deriveAuthoringModel({ ...authoring, value: recipes.components.Card });
  expect(invalid.kind).toBe('object');
  if (invalid.kind !== 'object') throw new Error('Expected a recipe object.');
  expect(invalid.fields.find((field) => field.path[0] === 'tone')).toMatchObject({
    kind: 'unsupported',
    inheritance: { value: 'default', overridden: true },
    diagnostic: { code: 'invalid-value', path: ['tone'] },
  });
  const mutation = applyAuthoringMutation(recipes.components.Card, {
    kind: 'unset',
    path: ['tone'],
  });
  if (!mutation.ok) throw new Error('Expected the central mutation to succeed.');
  const reset = updateThemeRecipeOverrides({
    recipes,
    kind: 'component',
    recipeName: meta.name,
    fields: mutation.value,
  });
  expect(reset).toEqual({ components: { Card: { unrelated: 'keep' } } });
  expect(recipes.components.Card.tone).toBe('removed-choice');
  const restored = deriveAuthoringModel({ ...authoring, value: reset?.components?.Card });
  if (restored.kind !== 'object') throw new Error('Expected a recipe object.');
  expect(restored.fields.find((field) => field.path[0] === 'tone')).toMatchObject({
    path: ['tone'],
    kind: 'choice',
    value: undefined,
    inheritance: { value: 'default', overridden: false },
  });
});

test('adapts pattern metadata with the same engine and preserves owner labels and help', () => {
  const meta: ZoraThemeRecipeMeta = {
    name: 'OwnerPattern',
    kind: 'pattern',
    description: 'Owner help',
    fields: { enabled: { type: 'boolean', label: 'Owner label', default: true } },
  };
  expect(
    deriveAuthoringModel({ ...resolveZoraThemeRecipeAuthoring(meta, () => []), value: {} }),
  ).toMatchObject({
    label: 'OwnerPattern',
    description: 'Owner help',
    fields: [
      expect.objectContaining({
        label: 'Owner label',
        value: undefined,
        inheritance: { value: true, overridden: false },
      }),
    ],
  });
});

function cardMetadata(): ZoraThemeRecipeMeta {
  const meta = ZORA_THEME_RECIPE_META.Card;
  if (!meta) throw new Error('The released ZORA Card recipe is missing.');
  return meta;
}
