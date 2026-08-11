import { expect, test } from 'bun:test';

import { applyScreensAdminAction, type ScreensAdminMutationTarget } from './screensAdminActions';

test('maps overview actions to canonical Studio manifest mutations', () => {
  const calls: unknown[][] = [];
  const target: ScreensAdminMutationTarget = {
    addScreen: (...args) => calls.push(['addScreen', ...args]),
    deleteScreen: (...args) => calls.push(['deleteScreen', ...args]),
    moveRoute: (...args) => calls.push(['moveRoute', ...args]),
    setNavigatorInitialRoute: (...args) => calls.push(['setNavigatorInitialRoute', ...args]),
    setNavigatorType: (...args) => calls.push(['setNavigatorType', ...args]),
    setRoutePrimaryNavigationVisibility: (...args) =>
      calls.push(['setRoutePrimaryNavigationVisibility', ...args]),
  };

  applyScreensAdminAction(target, { type: 'create-screen', name: 'Reports' });
  applyScreensAdminAction(target, { type: 'delete-screen', screenId: 'screen-old' });
  applyScreensAdminAction(target, { type: 'set-navigator-type', navigatorType: 'drawer' });
  applyScreensAdminAction(target, { type: 'set-initial-route', routeName: 'reports' });
  applyScreensAdminAction(target, {
    type: 'set-primary-navigation-visibility',
    parentPath: ['(app)'],
    routeName: 'reports',
    showInPrimaryNavigation: false,
  });
  applyScreensAdminAction(target, {
    type: 'move-route',
    parentPath: ['(app)'],
    routeName: 'reports',
    toIndex: 0,
  });

  expect(calls).toEqual([
    ['addScreen', 'Reports'],
    ['deleteScreen', 'screen-old'],
    ['setNavigatorType', 'drawer'],
    ['setNavigatorInitialRoute', 'reports'],
    ['setRoutePrimaryNavigationVisibility', ['(app)'], 'reports', false],
    ['moveRoute', ['(app)'], 'reports', 0],
  ]);
});
