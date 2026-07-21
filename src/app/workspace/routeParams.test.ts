import { expect, test } from 'bun:test';

import { resolveWorkspaceCategoryParam } from './routeParams';

test('preserves invalid category route params instead of rewriting them', () => {
  expect(resolveWorkspaceCategoryParam('games')).toEqual({
    category: 'games',
    categoryParam: 'games',
  });
  expect(resolveWorkspaceCategoryParam('not-a-category')).toEqual({
    category: null,
    categoryParam: 'not-a-category',
  });
});
