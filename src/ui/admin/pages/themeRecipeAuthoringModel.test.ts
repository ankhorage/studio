import { describe, expect, test } from 'bun:test';

import { updateThemeRecipeOverrides } from './themeRecipeAuthoringModel';

describe('themeRecipeAuthoringModel', () => {
  test('persists the centrally mutated component recipe override object', () => {
    expect(
      updateThemeRecipeOverrides({
        recipes: undefined,
        kind: 'component',
        recipeName: 'Button',
        fields: { size: 'l' },
      }),
    ).toEqual({ components: { Button: { size: 'l' } } });
  });

  test('preserves the complete centrally mutated recipe field object', () => {
    expect(
      updateThemeRecipeOverrides({
        recipes: {
          components: {
            Card: { staleField: 'preserve', tone: 'default' },
          },
        },
        kind: 'component',
        recipeName: 'Card',
        fields: { staleField: 'preserve', tone: 'subtle' },
      }),
    ).toEqual({
      components: { Card: { staleField: 'preserve', tone: 'subtle' } },
    });
  });

  test('persists a central mutation result with one override removed', () => {
    expect(
      updateThemeRecipeOverrides({
        recipes: { components: { Button: { size: 'l', variant: 'solid' } } },
        kind: 'component',
        recipeName: 'Button',
        fields: { variant: 'solid' },
      }),
    ).toEqual({ components: { Button: { variant: 'solid' } } });
  });

  test('removes empty recipe and bucket structures', () => {
    expect(
      updateThemeRecipeOverrides({
        recipes: { patterns: { Panel: { compact: true } } },
        kind: 'pattern',
        recipeName: 'Panel',
        fields: undefined,
      }),
    ).toBeUndefined();
  });
});
