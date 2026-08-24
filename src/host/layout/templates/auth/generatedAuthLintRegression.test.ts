import { expect, test } from 'bun:test';

import { getAuthSessionTs } from './session';
import { getSignOutScreenTsx } from './signOut';

test('generated session metadata uses guarded reflection without unsafe object indexing', () => {
  const session = getAuthSessionTs();

  expect(session).toContain('Reflect.get(value, key)');
  expect(session).toContain('return Object.fromEntries(entries);');
  expect(session).not.toContain('value[key]');
});

test('generated sign-out layout uses a canonical StyleSheet instead of inline styles', () => {
  const signOut = getSignOutScreenTsx();

  expect(signOut).toContain('StyleSheet.create({');
  expect(signOut).toContain('<View style={[styles.container,');
  expect(signOut).not.toContain('<View style={{');
});
