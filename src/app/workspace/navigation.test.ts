import { expect, test } from 'bun:test';

import { resolveWorkspaceParentPath } from './navigation';

test('resolves canonical workspace parent fallbacks for direct deep links', () => {
  expect(resolveWorkspaceParentPath('/')).toBeNull();
  expect(resolveWorkspaceParentPath('/projects/foo')).toBe('/');
  expect(resolveWorkspaceParentPath('/create')).toBe('/');
  expect(resolveWorkspaceParentPath('/create/games')).toBe('/create');
  expect(resolveWorkspaceParentPath('/create/games/chess')).toBe('/create/games');
  expect(resolveWorkspaceParentPath('/create/not-a-category/template')).toBe(
    '/create/not-a-category',
  );
});
