import { ConfirmDialog } from '@ankhorage/zora';
import React from 'react';

export interface StudioDeleteDialogProps {
  readonly label: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly visible: boolean;
}

export function StudioDeleteDialog(props: StudioDeleteDialogProps): React.JSX.Element {
  return (
    <ConfirmDialog
      cancelLabel="Cancel"
      confirmColor="danger"
      confirmLabel="Delete"
      description={`Delete ${props.label} and all of its children? This cannot be undone.`}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
      title="Delete component"
      visible={props.visible}
    />
  );
}
