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

export function openProjectUrl(url: string): boolean {
  if (isWeb() && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
