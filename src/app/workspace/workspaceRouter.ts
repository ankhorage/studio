import { type Href, router } from 'expo-router';

import { releaseWorkspaceFocus } from './navigation';

/*** Navigate forward after releasing browser focus from the outgoing Workspace route. */
export function pushWorkspaceRoute(href: Href): void {
  releaseWorkspaceFocus();
  router.push(href);
}

/*** Replace the current route after releasing browser focus from the outgoing Workspace route. */
export function replaceWorkspaceRoute(href: Href): void {
  releaseWorkspaceFocus();
  router.replace(href);
}

/*** Return to the preceding route after releasing browser focus from the outgoing Workspace route. */
export function goBackFromWorkspaceRoute(): void {
  releaseWorkspaceFocus();
  router.back();
}
