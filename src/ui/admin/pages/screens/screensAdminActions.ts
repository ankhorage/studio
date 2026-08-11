import type { NavigatorType } from '@ankhorage/contracts';

import type { StudioContextValue } from '../../../../index';

export type ScreensAdminAction =
  | { type: 'create-screen'; name: string }
  | { type: 'delete-screen'; screenId: string }
  | { type: 'set-navigator-type'; navigatorType: NavigatorType }
  | { type: 'set-initial-route'; routeName: string }
  | {
      type: 'set-primary-navigation-visibility';
      parentPath: string[];
      routeName: string;
      showInPrimaryNavigation: boolean;
    }
  | { type: 'move-route'; parentPath: string[]; routeName: string; toIndex: number };

export type ScreensAdminMutationTarget = Pick<
  StudioContextValue,
  | 'addScreen'
  | 'deleteScreen'
  | 'moveRoute'
  | 'setNavigatorInitialRoute'
  | 'setNavigatorType'
  | 'setRoutePrimaryNavigationVisibility'
>;

export function applyScreensAdminAction(
  target: ScreensAdminMutationTarget,
  action: ScreensAdminAction,
): void {
  switch (action.type) {
    case 'create-screen':
      target.addScreen(action.name);
      return;
    case 'delete-screen':
      target.deleteScreen(action.screenId);
      return;
    case 'set-navigator-type':
      target.setNavigatorType(action.navigatorType);
      return;
    case 'set-initial-route':
      target.setNavigatorInitialRoute(action.routeName);
      return;
    case 'set-primary-navigation-visibility':
      target.setRoutePrimaryNavigationVisibility(
        action.parentPath,
        action.routeName,
        action.showInPrimaryNavigation,
      );
      return;
    case 'move-route':
      target.moveRoute(action.parentPath, action.routeName, action.toIndex);
  }
}
