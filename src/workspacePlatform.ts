import { confirmAction } from '@ankhorage/utility/interaction';
import { isBrowserRuntime, openUrl } from '@ankhorage/utility/web';

export interface DeleteConfirmationButton {
  readonly text: string;
  readonly style?: 'cancel' | 'default' | 'destructive';
  readonly onPress?: () => void;
}

export type DeleteConfirmationAlert = (
  title: string,
  message?: string,
  buttons?: DeleteConfirmationButton[],
) => void;

export interface DeleteConfirmationDependencies {
  readonly alert: DeleteConfirmationAlert;
  readonly confirm?: (message: string) => boolean;
  readonly isWeb: boolean;
}

/***
 * Create a confirmation action that uses browser confirm when available and an injected alert otherwise.
 * @utility @ankhorage/utility/interaction
 */
export function createDeleteConfirmation(dependencies: DeleteConfirmationDependencies) {
  return (name: string, onConfirm: () => void): void => {
    confirmAction(
      {
        title: 'Delete project',
        message: `Delete ${name}?`,
        confirmText: 'Delete',
        destructive: true,
      },
      {
        alert: (title, message, buttons) =>
          dependencies.alert(title, message, buttons ? [...buttons] : undefined),
        confirm: dependencies.confirm,
        preferConfirm: dependencies.isWeb,
      },
      onConfirm,
    );
  };
}

/***
 * Ask for deletion confirmation using browser globals or an injected alert implementation.
 * @utility @ankhorage/utility/interaction
 */
export function confirmDelete(
  name: string,
  onConfirm: () => void,
  alert?: DeleteConfirmationAlert,
): void {
  const webConfirm =
    isBrowserRuntime() && typeof window.confirm === 'function'
      ? window.confirm.bind(window)
      : undefined;

  if (!webConfirm && !alert) return;

  createDeleteConfirmation({
    alert:
      alert ??
      (() => {
        // Web confirmations are handled above; native callers inject Alert.alert.
      }),
    confirm: webConfirm,
    isWeb: isBrowserRuntime(),
  })(name, onConfirm);
}

/***
 * Open a URL in a new browser tab without granting opener access and report whether opening was attempted.
 * @utility @ankhorage/utility/web
 */
export function openProjectUrl(url: string): boolean {
  const opener =
    isBrowserRuntime() && typeof window.open === 'function' ? window.open.bind(window) : undefined;
  return openUrl(url, opener);
}
