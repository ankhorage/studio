import { expect, test } from 'bun:test';

import { applyAuthoringMutation } from './applyAuthoringMutation';

test('sets and unsets authored values immutably', () => {
  const current: {
    readonly id: string;
    readonly name: string;
    readonly title?: string;
    readonly nested: { readonly note: string };
  } = {
    id: 'screen-home',
    name: 'Home',
    title: 'Welcome',
    nested: { note: 'keep' },
  };

  const renamed = applyAuthoringMutation(current, {
    kind: 'set',
    path: ['name'],
    value: 'Dashboard',
  });
  expect(renamed).toEqual({
    ok: true,
    value: {
      id: 'screen-home',
      name: 'Dashboard',
      title: 'Welcome',
      nested: { note: 'keep' },
    },
  });
  expect(current.name).toBe('Home');

  const untitled = applyAuthoringMutation(current, {
    kind: 'unset',
    path: ['title'],
  });
  expect(untitled).toEqual({
    ok: true,
    value: {
      id: 'screen-home',
      name: 'Home',
      nested: { note: 'keep' },
    },
  });
});

test('rejects traversal through missing or non-object paths', () => {
  const result = applyAuthoringMutation(
    { name: 'Home' },
    { kind: 'set', path: ['missing', 'child'], value: 'value' },
  );

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostic).toMatchObject({
    code: 'mutation-rejected',
    path: ['missing', 'child'],
  });
});

test('renames value-map keys atomically and rejects duplicate targets', () => {
  const current: {
    readonly tokens: { readonly spacing: Readonly<Record<string, number>> };
  } = { tokens: { spacing: { m: 16, l: 24 } } };

  const renamed = applyAuthoringMutation(current, {
    kind: 'rename-key',
    path: ['tokens', 'spacing'],
    fromKey: 'm',
    toKey: 'medium',
  });
  expect(renamed).toEqual({
    ok: true,
    value: { tokens: { spacing: { medium: 16, l: 24 } } },
  });
  expect(current.tokens.spacing).toEqual({ m: 16, l: 24 });

  const duplicate = applyAuthoringMutation(current, {
    kind: 'rename-key',
    path: ['tokens', 'spacing'],
    fromKey: 'm',
    toKey: 'l',
  });
  expect(duplicate.ok).toBe(false);
  if (duplicate.ok) return;
  expect(duplicate.diagnostic).toMatchObject({
    code: 'mutation-rejected',
    path: ['tokens', 'spacing'],
  });
});
