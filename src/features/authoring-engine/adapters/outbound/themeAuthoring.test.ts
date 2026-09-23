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

test('materializes and prunes Theme token overrides through the canonical update boundary', () => {
  const withoutTokens: ThemeConfig = {
    id: 'theme-default',
    name: 'Default',
    light: theme.light,
    dark: theme.dark,
  };
  expect(
    applyThemeAuthoringMutation(withoutTokens, {
      kind: 'set',
      path: ['tokens', 'spacing', 'm'],
      value: 18,
    }),
  ).toEqual({
    ok: true,
    value: { tokens: { spacing: { m: 18 } } },
  });

  expect(
    applyThemeAuthoringMutation(
      { ...withoutTokens, tokens: { spacing: { m: 18 } } },
      {
        kind: 'unset',
        path: ['tokens', 'spacing', 'm'],
      },
    ),
  ).toEqual({ ok: true, value: { tokens: undefined } });
});

test('renames custom tokens immutably and projects only the touched Theme branch', () => {
  const renamed = applyThemeAuthoringMutation(theme, {
    kind: 'rename-key',
    path: ['tokens', 'spacing'],
    fromKey: 'm',
    toKey: 'medium',
  });

  expect(renamed).toEqual({
    ok: true,
    value: { tokens: { spacing: { medium: 20 } } },
  });
  expect(theme.tokens?.spacing).toEqual({ m: 20 });
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
