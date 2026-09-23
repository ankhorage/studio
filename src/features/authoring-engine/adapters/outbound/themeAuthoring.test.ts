import type { ThemeConfig } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { applyThemeAuthoringMutation } from './applyThemeAuthoringMutation';
import { deriveThemeAuthoringModel } from './deriveThemeAuthoringModel';

const theme: ThemeConfig = {
  id: 'theme-default',
  name: 'Default',
  light: { primaryColor: '#3366ff', harmony: 'analogous' },
  dark: { primaryColor: '#7799ff', harmony: 'complementary' },
  tokens: { spacing: { m: 20 } },
};

test('derives every released Theme harmony choice including square', () => {
  const model = deriveThemeAuthoringModel({ theme, path: ['light'] });

  expect(model.kind).toBe('object');
  if (model.kind !== 'object') return;
  const harmony = model.fields.find((field) => field.path.at(-1) === 'harmony');
  expect(harmony).toMatchObject({
    kind: 'choice',
    values: [
      'analogous',
      'complementary',
      'monochromatic',
      'splitComplementary',
      'square',
      'tetradic',
      'triadic',
    ],
    value: 'analogous',
  });
});

test('projects resolved Theme token values as inheritance without materializing them', () => {
  const model = deriveThemeAuthoringModel({
    theme,
    path: ['tokens', 'spacing'],
    resolvedValue: { tokens: { spacing: { s: 8, m: 16 } } },
  });

  expect(model).toMatchObject({
    kind: 'value-map',
    entries: [
      {
        key: 'm',
        authored: true,
        value: {
          value: 20,
          inheritance: { value: 16, overridden: true },
        },
      },
      {
        key: 's',
        authored: false,
        value: {
          value: undefined,
          inheritance: { value: 8, overridden: false },
        },
      },
    ],
  });
});

test('materializes and prunes Theme token overrides through the owner structure', () => {
  const withoutTokens: ThemeConfig = {
    id: 'theme-default',
    name: 'Default',
    light: theme.light,
    dark: theme.dark,
  };
  const added = applyThemeAuthoringMutation(withoutTokens, {
    kind: 'set',
    path: ['tokens', 'spacing', 'm'],
    value: 18,
  });
  expect(added).toEqual({
    ok: true,
    value: { ...withoutTokens, tokens: { spacing: { m: 18 } } },
  });

  if (!added.ok) return;
  expect(
    applyThemeAuthoringMutation(added.value, {
      kind: 'unset',
      path: ['tokens', 'spacing', 'm'],
    }),
  ).toEqual({ ok: true, value: withoutTokens });
});

test('keeps Theme-specific presentation hints separate from owner structure', () => {
  const model = deriveThemeAuthoringModel({
    theme,
    path: ['light'],
    policy: {
      fields: {
        light: {
          fields: {
            primaryColor: { editor: { kind: 'theme-hex-color' } },
          },
        },
      },
    },
  });

  expect(model.kind).toBe('object');
  if (model.kind !== 'object') return;
  expect(model.fields.find((field) => field.path.at(-1) === 'primaryColor')).toMatchObject({
    kind: 'scalar',
    editor: { kind: 'theme-hex-color' },
  });
});
