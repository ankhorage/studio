import { expect, test } from 'bun:test';

import { releaseWorkspaceFocus, resolveWorkspaceParentPath } from './navigation';

test('releases the focused element before a Workspace route transition', () => {
  let blurred = false;

  releaseWorkspaceFocus({
    blur: () => {
      blurred = true;
    },
  });

  expect(blurred).toBe(true);
});

test('does not require a focused element before a Workspace route transition', () => {
  expect(() => releaseWorkspaceFocus(null)).not.toThrow();
});

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
