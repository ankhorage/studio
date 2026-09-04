/***
 * Report whether browser globals are available in the current runtime.
 * @utility @ankhorage/utility/web
 */
function isWeb(): boolean {
  return typeof window !== 'undefined';
}

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
    const message = `Delete ${name}?`;

    if (dependencies.isWeb && dependencies.confirm) {
      if (dependencies.confirm(message)) {
        onConfirm();
      }
      return;
    }

    dependencies.alert('Delete project', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]);
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
    isWeb() && typeof window.confirm === 'function' ? window.confirm.bind(window) : undefined;

  if (!webConfirm && !alert) return;

  createDeleteConfirmation({
    alert:
      alert ??
      (() => {
        // Web confirmations are handled above; native callers inject Alert.alert.
      }),
    confirm: webConfirm,
    isWeb: isWeb(),
  })(name, onConfirm);
}

/***
 * Open a URL in a new browser tab without granting opener access and report whether opening was attempted.
 * @utility @ankhorage/utility/web
 */
export function openProjectUrl(url: string): boolean {
  if (isWeb() && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
