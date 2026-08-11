import { Button, Input, ListRow, ListSection, Modal, Stack } from '@ankhorage/zora';
import type { UiNode } from '@ankhorage/contracts';
import React from 'react';
import { ScrollView } from 'react-native';

import type { InsertCatalogEntry, StudioComponentMetaRegistry } from '../index';
import { getInsertCatalogCategoryLabel } from '../index';
import {
  filterInsertCatalogEntries,
  getPlacementHint,
  groupInsertEntries,
} from '../insertModalModel';

export interface StudioInsertDialogProps {
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly entries: InsertCatalogEntry[];
  readonly findNode: (id: string) => UiNode | null;
  readonly onDismiss: () => void;
  readonly onInsert: (entry: InsertCatalogEntry) => boolean;
  readonly rootNode: UiNode | null;
  readonly visible: boolean;
}

export function StudioInsertDialog(props: StudioInsertDialogProps): React.JSX.Element {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!props.visible) setQuery('');
  }, [props.visible]);

  const groups = groupInsertEntries({
    entries: filterInsertCatalogEntries(props.entries, query),
    getCategoryLabel: getInsertCatalogCategoryLabel,
  });

  return (
    <Modal
      closeOnBackdrop
      description="Choose a component or recipe for the current canvas context."
      footer={
        <Button color="neutral" variant="ghost" onPress={props.onDismiss}>
          Cancel
        </Button>
      }
      onDismiss={props.onDismiss}
      title="Insert"
      visible={props.visible}
      width="wide"
    >
      <Stack gap="m">
        <Input
          accessibilityLabel="Search insert catalog"
          onChangeText={setQuery}
          placeholder="Search components and recipes"
          value={query}
        />
        <ScrollView style={{ maxHeight: 520 }}>
          <Stack gap="l">
            {groups.map((group) => (
              <ListSection key={group.category} title={group.label}>
                {group.entries.map((entry) => {
                  const placementHint = getPlacementHint({
                    entry,
                    rootNode: props.rootNode,
                    findNode: (root, id) => props.findNode(id) ?? (root.id === id ? root : null),
                    componentMeta: props.componentMeta,
                  });
                  const description =
                    entry.status === 'disabled' ? entry.disabledReason?.detail : entry.description;

                  return entry.status === 'enabled' ? (
                    <ListRow
                      key={entry.id}
                      description={description}
                      meta={placementHint}
                      onPress={() => props.onInsert(entry)}
                      title={entry.label}
                    />
                  ) : (
                    <ListRow
                      key={entry.id}
                      disabled
                      description={description}
                      title={entry.label}
                    />
                  );
                })}
              </ListSection>
            ))}
          </Stack>
        </ScrollView>
      </Stack>
    </Modal>
  );
}
