import { Button, Dialog, View } from '@ankhorage/zora';
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
        <View direction={{ base: 'column', md: 'row' }} gap="s" justify="flex-end">
          <Button color="neutral" variant="soft" onPress={props.onCancel}>
            Cancel
          </Button>
          <Button color="danger" onPress={props.onConfirm}>
            Delete
          </Button>
        </View>
      }
      onDismiss={props.onCancel}
      title="Delete component"
      visible={props.visible}
    />
  );
}
