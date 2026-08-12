import { describe, expect, test } from 'bun:test';

import { updateThemeRecipeField } from './themeRecipeAuthoringModel';

describe('themeRecipeAuthoringModel', () => {
  test('persists only the selected component recipe override value', () => {
    expect(
      updateThemeRecipeField({
        recipes: undefined,
        kind: 'component',
        recipeName: 'Button',
        fieldName: 'size',
        value: 'l',
      }),
    ).toEqual({ components: { Button: { size: 'l' } } });
  });

  test('preserves sibling and stale values while editing a known field', () => {
    expect(
      updateThemeRecipeField({
        recipes: {
          components: {
            Card: { staleField: 'preserve', tone: 'default' },
          },
        },
        kind: 'component',
        recipeName: 'Card',
        fieldName: 'tone',
        value: 'subtle',
      }),
    ).toEqual({
      components: { Card: { staleField: 'preserve', tone: 'subtle' } },
    });
  });

  test('reset removes the field instead of copying a metadata default', () => {
    expect(
      updateThemeRecipeField({
        recipes: { components: { Button: { size: 'l', variant: 'solid' } } },
        kind: 'component',
        recipeName: 'Button',
        fieldName: 'size',
        value: undefined,
      }),
    ).toEqual({ components: { Button: { variant: 'solid' } } });
  });

  test('reset removes empty recipe and bucket structures', () => {
    expect(
      updateThemeRecipeField({
        recipes: { patterns: { Panel: { compact: true } } },
        kind: 'pattern',
        recipeName: 'Panel',
        fieldName: 'compact',
        value: undefined,
      }),
    ).toBeUndefined();
  });
});
