import { Button, Field, Select, Text } from '@ankhorage/zora';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  AuthoringMutation,
  AuthoringOrderedListNode,
} from '../../../../types/authoring-engine';

interface OrderedListEditorProps {
  readonly model: AuthoringOrderedListNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}

/*** Render one ordered finite-string list with explicit replace, reorder, remove, and add operations. */
export function OrderedListEditor({ model, onMutation }: OrderedListEditorProps) {
  const options = model.choices.map((value) => ({ label: value, value }));

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.list}>
        {model.items.length === 0 ? (
          <Text color="neutral" emphasis="muted" variant="caption">
            No items
          </Text>
        ) : null}
        {model.items.map((item, index) => (
          <View key={`${index}:${item}`} style={styles.itemRow}>
            <Select
              options={options}
              value={item}
              onValueChange={(value) =>
                onMutation({
                  kind: 'set',
                  path: model.path,
                  value: replaceOrderedItem(model.items, index, value),
                })
              }
            />
            <View style={styles.itemActions}>
              <Button
                variant="outline"
                disabled={index === 0}
                onPress={() =>
                  onMutation({
                    kind: 'set',
                    path: model.path,
                    value: moveOrderedItem(model.items, index, index - 1),
                  })
                }
              >
                Move up
              </Button>
              <Button
                variant="outline"
                disabled={index === model.items.length - 1}
                onPress={() =>
                  onMutation({
                    kind: 'set',
                    path: model.path,
                    value: moveOrderedItem(model.items, index, index + 1),
                  })
                }
              >
                Move down
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  const items = removeOrderedItem(model.items, index);
                  onMutation(
                    model.optional && items.length === 0
                      ? { kind: 'unset', path: model.path }
                      : { kind: 'set', path: model.path, value: items },
                  );
                }}
              >
                Remove
              </Button>
            </View>
          </View>
        ))}
        <View style={styles.addActions}>
          {model.choices.map((choice) => (
            <Button
              key={choice}
              variant="outline"
              onPress={() =>
                onMutation({
                  kind: 'set',
                  path: model.path,
                  value: [...model.items, choice],
                })
              }
            >
              {`Add ${choice}`}
            </Button>
          ))}
        </View>
      </View>
    </Field>
  );
}

/*** Replace one ordered-list item without changing the position of any sibling. */
function replaceOrderedItem(
  items: readonly string[],
  index: number,
  value: string,
): readonly string[] {
  return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

/*** Move one ordered-list item to an explicit sibling index without changing item identity. */
function moveOrderedItem(
  items: readonly string[],
  fromIndex: number,
  toIndex: number,
): readonly string[] {
  const item = items.at(fromIndex);
  if (item === undefined || toIndex < 0 || toIndex >= items.length) return items;
  const withoutItem = items.filter((_value, index) => index !== fromIndex);
  return [...withoutItem.slice(0, toIndex), item, ...withoutItem.slice(toIndex)];
}

/*** Remove one ordered-list item while preserving the relative order of the remaining items. */
function removeOrderedItem(items: readonly string[], index: number): readonly string[] {
  return items.filter((_value, itemIndex) => itemIndex !== index);
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  itemRow: {
    gap: 8,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
