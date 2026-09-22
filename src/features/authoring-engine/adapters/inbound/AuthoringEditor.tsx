import { Button, Field, Select, Switch, Text, TextInput } from '@ankhorage/zora';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  AuthoringChoiceNode,
  AuthoringMutation,
  AuthoringNode,
  AuthoringOrderedListNode,
  AuthoringScalarNode,
  AuthoringSetNode,
} from '../../../../types/authoring-engine';

export interface AuthoringCustomControlProps {
  readonly model: AuthoringNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}

export interface AuthoringEditorProps {
  readonly model: AuthoringNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
  readonly renderCustomControl?: (props: AuthoringCustomControlProps) => ReactNode | undefined;
}

/*** Render one neutral authoring model with ZORA controls without owning product-specific schema. */
export function AuthoringEditor({ model, onMutation, renderCustomControl }: AuthoringEditorProps) {
  const { inheritance } = model;
  if (!inheritance || !model.optional || model.readOnly) {
    return (
      <AuthoringControl
        model={model}
        onMutation={onMutation}
        renderCustomControl={renderCustomControl}
      />
    );
  }

  return (
    <View style={styles.fields}>
      <AuthoringControl
        model={model}
        onMutation={onMutation}
        renderCustomControl={renderCustomControl}
      />
      <Text color="neutral" emphasis="muted" variant="caption">
        {inheritance.overridden ? 'Override' : 'Inherited'}
        {inheritance.value === undefined ? '' : ` (default: ${String(inheritance.value)})`}
      </Text>
      <Button
        variant="outline"
        disabled={!inheritance.overridden}
        onPress={() => onMutation({ kind: 'unset', path: model.path })}
      >
        {`Use inherited ${model.label}`}
      </Button>
    </View>
  );
}

/*** Choose the ZORA control for one neutral structural node. */
function AuthoringControl({ model, onMutation, renderCustomControl }: AuthoringEditorProps) {
  const customControl = model.editor ? renderCustomControl?.({ model, onMutation }) : undefined;
  if (customControl !== undefined && !model.readOnly) {
    return (
      <Field label={model.label} description={model.description} required={!model.optional}>
        {customControl}
      </Field>
    );
  }

  if (model.kind === 'object') {
    return (
      <View style={styles.fields}>
        {model.fields.map((field) => (
          <AuthoringEditor
            key={field.path.join('.')}
            model={field}
            onMutation={onMutation}
            renderCustomControl={renderCustomControl}
          />
        ))}
      </View>
    );
  }

  if (model.kind === 'unsupported') {
    return (
      <Field label={model.label} description={model.description} required={!model.optional}>
        <Text color="neutral" emphasis="muted" variant="caption">
          {model.diagnostic.message}
        </Text>
      </Field>
    );
  }

  if (model.readOnly) {
    return (
      <Field
        label={model.label}
        description={model.description}
        readOnly
        required={!model.optional}
      >
        <Text>{formatAuthoringNodeValue(model)}</Text>
      </Field>
    );
  }

  if (model.kind === 'choice') {
    return <ChoiceEditor model={model} onMutation={onMutation} />;
  }

  if (model.kind === 'set') {
    return <SetEditor model={model} onMutation={onMutation} />;
  }

  if (model.kind === 'ordered-list') {
    return <OrderedListEditor model={model} onMutation={onMutation} />;
  }

  return <ScalarEditor model={model} onMutation={onMutation} />;
}

/*** Render one finite primitive choice and translate its control value back to the owner value. */
function ChoiceEditor(props: {
  readonly model: AuthoringChoiceNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const { model } = props;
  const stringOnly = model.values.every((value) => typeof value === 'string');
  const options = model.values.map((value) => ({
    label: String(value),
    value: stringOnly ? String(value) : encodeChoiceValue(value),
  }));
  const effective = model.value === undefined ? model.inheritance?.value : model.value;
  const current =
    effective === undefined
      ? undefined
      : stringOnly
        ? String(effective)
        : encodeChoiceValue(effective);

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <Select
        options={options}
        value={current}
        onValueChange={(controlValue) => {
          const value = stringOnly
            ? model.values.find((candidate) => candidate === controlValue)
            : model.values.find((candidate) => encodeChoiceValue(candidate) === controlValue);
          if (value !== undefined) {
            props.onMutation({ kind: 'set', path: model.path, value });
          }
        }}
      />
    </Field>
  );
}

/*** Render finite unordered string membership with one switch per owner-provided member. */
function SetEditor(props: {
  readonly model: AuthoringSetNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const { model } = props;

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.membership}>
        {model.values.map((member) => (
          <View key={member} style={styles.membershipRow}>
            <Switch
              checked={model.selected.includes(member)}
              onCheckedChange={(checked) => {
                const selected = checked
                  ? model.values.filter(
                      (candidate) => candidate === member || model.selected.includes(candidate),
                    )
                  : model.selected.filter((candidate) => candidate !== member);
                if (model.optional && selected.length === 0) {
                  props.onMutation({ kind: 'unset', path: model.path });
                  return;
                }
                props.onMutation({
                  kind: 'set',
                  path: model.path,
                  value: Object.fromEntries(
                    selected.map((candidate) => [candidate, true] as const),
                  ),
                });
              }}
            />
            <Text>{member}</Text>
          </View>
        ))}
      </View>
    </Field>
  );
}

/*** Render an ordered primitive list with editing, append, remove, and positional controls. */
function OrderedListEditor(props: {
  readonly model: AuthoringOrderedListNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const { model } = props;

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.membership}>
        {model.items.map((item, index) => (
          <View key={`${encodeChoiceValue(item)}:${index}`} style={styles.orderedListRow}>
            {model.item.kind === 'choice' ? (
              <Text>{String(item)}</Text>
            ) : (
              <View style={styles.orderedListInput}>
                <TextInput
                  value={typeof item === 'string' ? item : ''}
                  autoCapitalize="none"
                  onChangeText={(value) =>
                    props.onMutation({
                      kind: 'set',
                      path: model.path,
                      value: model.items.map((candidate, candidateIndex) =>
                        candidateIndex === index ? value : candidate,
                      ),
                    })
                  }
                />
              </View>
            )}
            <Button
              variant="outline"
              disabled={index === 0}
              onPress={() =>
                props.onMutation({
                  kind: 'set',
                  path: model.path,
                  value: moveOrderedListItem(model.items, index, index - 1),
                })
              }
            >
              Up
            </Button>
            <Button
              variant="outline"
              disabled={index === model.items.length - 1}
              onPress={() =>
                props.onMutation({
                  kind: 'set',
                  path: model.path,
                  value: moveOrderedListItem(model.items, index, index + 1),
                })
              }
            >
              Down
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                const items = model.items.filter((_, candidateIndex) => candidateIndex !== index);
                if (model.optional && items.length === 0) {
                  props.onMutation({ kind: 'unset', path: model.path });
                  return;
                }
                props.onMutation({ kind: 'set', path: model.path, value: items });
              }}
            >
              Remove
            </Button>
          </View>
        ))}
        <View style={styles.orderedListAdd}>
          {model.item.kind === 'choice' ? (
            model.item.values.map((value) => (
              <Button
                key={encodeChoiceValue(value)}
                variant="outline"
                onPress={() =>
                  props.onMutation({
                    kind: 'set',
                    path: model.path,
                    value: [...model.items, value],
                  })
                }
              >
                {`Add ${String(value)}`}
              </Button>
            ))
          ) : (
            <Button
              variant="outline"
              onPress={() =>
                props.onMutation({
                  kind: 'set',
                  path: model.path,
                  value: [...model.items, ''],
                })
              }
            >
              Add item
            </Button>
          )}
        </View>
      </View>
    </Field>
  );
}

/*** Move one ordered-list item immutably while preserving every other authored item. */
function moveOrderedListItem(
  items: readonly (string | number | boolean | null)[],
  fromIndex: number,
  toIndex: number,
): readonly (string | number | boolean | null)[] {
  if (fromIndex === toIndex) return items;
  const moved = items.at(fromIndex);
  const displaced = items.at(toIndex);
  if (moved === undefined || displaced === undefined || toIndex < 0 || toIndex >= items.length)
    return items;
  return items.map((item, index) => {
    if (index === fromIndex) return displaced;
    if (index === toIndex) return moved;
    return item;
  });
}

/*** Render one scalar authoring node and translate ZORA changes to neutral mutations. */
function ScalarEditor(props: {
  readonly model: AuthoringScalarNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const { model } = props;
  if (model.scalarType === 'boolean') {
    return (
      <Field label={model.label} description={model.description} required={!model.optional}>
        <Switch
          checked={(model.value === undefined ? model.inheritance?.value : model.value) === true}
          onCheckedChange={(checked) =>
            props.onMutation({ kind: 'set', path: model.path, value: checked })
          }
        />
      </Field>
    );
  }

  if (model.scalarType === 'null') {
    return (
      <Field label={model.label} description={model.description} required={!model.optional}>
        <Text>null</Text>
      </Field>
    );
  }

  const effective = model.value === undefined ? model.inheritance?.value : model.value;
  const value =
    typeof effective === 'number' || typeof effective === 'string' ? String(effective) : '';
  const numeric = model.scalarType === 'integer' || model.scalarType === 'number';

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <TextInput
        value={value}
        keyboardType={numeric ? 'numeric' : undefined}
        multiline={model.multiline}
        numberOfLines={model.multiline ? 4 : undefined}
        onChangeText={(text) => handleScalarTextChange(model, text, props.onMutation)}
      />
    </Field>
  );
}

/*** Convert text input to a scalar set/unset mutation without coercing invalid numeric values. */
function handleScalarTextChange(
  model: AuthoringScalarNode,
  text: string,
  onMutation: (mutation: AuthoringMutation) => void,
): void {
  if (model.optional && text === '') {
    onMutation({ kind: 'unset', path: model.path });
    return;
  }

  if (model.scalarType === 'string') {
    onMutation({ kind: 'set', path: model.path, value: text });
    return;
  }

  const numericValue = Number(text);
  const valid =
    Number.isFinite(numericValue) &&
    (model.scalarType !== 'integer' || Number.isInteger(numericValue));
  if (valid) onMutation({ kind: 'set', path: model.path, value: numericValue });
}

/*** Encode a primitive choice into a stable Select value without losing its runtime type. */
function encodeChoiceValue(value: string | number | boolean | null): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

/*** Format one supported authored node for read-only presentation. */
function formatAuthoringNodeValue(
  model: AuthoringChoiceNode | AuthoringOrderedListNode | AuthoringScalarNode | AuthoringSetNode,
): string {
  if (model.kind === 'set')
    return model.selected.length > 0 ? model.selected.join(', ') : 'Not set';
  if (model.kind === 'ordered-list')
    return model.items.length > 0 ? model.items.map(String).join(', ') : 'Not set';
  if (model.value === undefined) return 'Not set';
  if (model.value === null) return 'null';
  return String(model.value);
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
  membership: {
    gap: 8,
  },
  membershipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  orderedListRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderedListAdd: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderedListInput: {
    flex: 1,
    minWidth: 160,
  },
});
