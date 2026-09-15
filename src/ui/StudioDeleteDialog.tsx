import { Button, ButtonGroup, Dialog } from '@ankhorage/zora';
import React from 'react';

export interface StudioDeleteDialogProps {
  readonly label: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly visible: boolean;
}

export function StudioDeleteDialog(props: StudioDeleteDialogProps): React.JSX.Element {
  return (
    <Dialog
      description={`Delete ${props.label} and all of its children? This cannot be undone.`}
      footer={
        <ButtonGroup align="end" orientation="responsive">
          <Button color="neutral" variant="ghost" onPress={props.onCancel}>
            Cancel
          </Button>
          <Button color="danger" onPress={props.onConfirm}>
            Delete
          </Button>
        </ButtonGroup>
      }
      onDismiss={props.onCancel}
      title="Delete component"
      visible={props.visible}
    />
  );
}
