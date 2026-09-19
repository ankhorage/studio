import { expect, test } from 'bun:test';

import { applyAuthoringMutation } from './applyAuthoringMutation';

test('sets and unsets authored values immutably', () => {
  const current = {
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
