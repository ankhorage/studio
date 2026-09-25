import { Button, Field, Select, Switch, Text, TextInput } from '@ankhorage/zora';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  AuthoringChoiceNode,
  AuthoringEntityRegistryNode,
  AuthoringMutation,
  AuthoringNode,
  AuthoringOrderedListNode,
  AuthoringScalarNode,
  AuthoringSetNode,
  AuthoringUnionNode,
  AuthoringValueMapNode,
} from '../../../../types/authoring-engine';
import { createInitialAuthoringValue } from '../../application/use-cases/createInitialAuthoringValue';
import { createInitialEntityRegistryValue } from '../../application/use-cases/createInitialEntityRegistryValue';

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

  if (model.kind === 'value-map') {
    return (
      <ValueMapEditor
        model={model}
        onMutation={onMutation}
        renderCustomControl={renderCustomControl}
      />
    );
  }

  if (model.kind === 'entity-registry') {
    return (
      <EntityRegistryEditor
        model={model}
        onMutation={onMutation}
        renderCustomControl={renderCustomControl}
      />
    );
  }

  if (model.kind === 'union') {
    return (
      <UnionEditor
        model={model}
        onMutation={onMutation}
        renderCustomControl={renderCustomControl}
      />
    );
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

/*** Render keyed map entries with recursive values, atomic rename, removal, and structural insertion. */
function ValueMapEditor(props: {
  readonly model: AuthoringValueMapNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
  readonly renderCustomControl?: AuthoringEditorProps['renderCustomControl'];
}) {
  const { model } = props;
  const newKey = resolveNextValueMapKey(model);
  const initialValue = createInitialAuthoringValue(model.valueStructure);

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.membership}>
        {model.entries.map((entry) => (
          <View key={entry.key} style={styles.valueMapRow}>
            <View style={styles.valueMapKey}>
              <TextInput
                defaultValue={entry.key}
                readOnly={!entry.authored}
                autoCapitalize="none"
                onEndEditing={(event) => {
                  if (!entry.authored) return;
                  const toKey = event.nativeEvent.text;
                  if (
                    toKey === entry.key ||
                    model.entries.some((candidate) => candidate.key === toKey)
                  ) {
                    return;
                  }
                  props.onMutation({
                    kind: 'rename-key',
                    path: model.path,
                    fromKey: entry.key,
                    toKey,
                  });
                }}
              />
            </View>
            <View style={styles.valueMapValue}>
              <AuthoringEditor
                model={entry.value}
                onMutation={props.onMutation}
                renderCustomControl={props.renderCustomControl}
              />
            </View>
            {entry.authored ? (
              <Button
                variant="outline"
                onPress={() => {
                  const authoredCount = model.entries.filter(
                    (candidate) => candidate.authored,
                  ).length;
                  if (model.optional && authoredCount === 1) {
                    props.onMutation({ kind: 'unset', path: model.path });
                    return;
                  }
                  props.onMutation({ kind: 'unset', path: [...model.path, entry.key] });
                }}
              >
                Remove
              </Button>
            ) : null}
          </View>
        ))}
        {newKey !== undefined && initialValue !== undefined ? (
          <Button
            variant="outline"
            onPress={() =>
              props.onMutation({
                kind: 'set',
                path: [...model.path, newKey],
                value: initialValue,
              })
            }
          >
            Add entry
          </Button>
        ) : null}
      </View>
    </Field>
  );
}

/*** Render stable keyed entities without exposing key rename as an entity operation. */
function EntityRegistryEditor(props: {
  readonly model: AuthoringEntityRegistryNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
  readonly renderCustomControl?: AuthoringEditorProps['renderCustomControl'];
}) {
  const { model } = props;
  const pendingKey = { value: '' };

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.membership}>
        {model.entries.map((entry) => (
          <View key={entry.key} style={styles.valueMapRow}>
            <View style={styles.valueMapKey}>
              <Text>{entry.key}</Text>
            </View>
            <View style={styles.valueMapValue}>
              <AuthoringEditor
                model={entry.value}
                onMutation={props.onMutation}
                renderCustomControl={props.renderCustomControl}
              />
            </View>
            <Button
              variant="outline"
              onPress={() => props.onMutation({ kind: 'unset', path: [...model.path, entry.key] })}
            >
              Remove
            </Button>
          </View>
        ))}
        {model.key.kind === 'scalar' ? (
          <View style={styles.registryAdd}>
            <TextInput
              placeholder="Entity identity"
              autoCapitalize="none"
              onChangeText={(value) => {
                pendingKey.value = value;
              }}
            />
            <Button
              variant="outline"
              onPress={() => addRegistryEntity(props, pendingKey.value)}
            >
              Add entity
            </Button>
          </View>
        ) : (
          <FiniteRegistryAdd model={model} onMutation={props.onMutation} />
        )}
      </View>
    </Field>
  );
}

/*** Insert one open-key registry entity only after its stable owner identity has been supplied. */
function addRegistryEntity(
  props: Pick<AuthoringEditorProps, 'onMutation'> & { readonly model: AuthoringEntityRegistryNode },
  candidate: string,
): void {
  const key = candidate.trim();
  if (key === '' || props.model.entries.some((entry) => entry.key === key)) return;
  const initial = createInitialEntityRegistryValue(
    props.model.valueStructure,
    props.model.identityField,
    key,
  );
  if (initial === undefined) return;
  props.onMutation({ kind: 'set', path: [...props.model.path, key], value: initial });
}

/*** Render deterministic insertion for finite owner-defined registry identities. */
function FiniteRegistryAdd(props: {
  readonly model: AuthoringEntityRegistryNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const key = resolveNextFiniteRegistryKey(props.model);
  if (key === undefined) return null;
  const initial = createInitialEntityRegistryValue(
    props.model.valueStructure,
    props.model.identityField,
    key,
  );
  if (initial === undefined) return null;

  return (
    <Button
      variant="outline"
      onPress={() => props.onMutation({ kind: 'set', path: [...props.model.path, key], value: initial })}
    >
      Add entity
    </Button>
  );
}

/*** Render explicit discriminated-union selection plus the selected variant detail editor. */
function UnionEditor(props: {
  readonly model: AuthoringUnionNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
  readonly renderCustomControl?: AuthoringEditorProps['renderCustomControl'];
}) {
  const { model } = props;
  const options = model.variants.map((variant) => ({
    label: String(variant.value),
    value: encodeChoiceValue(variant.value),
  }));

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <View style={styles.fields}>
        <Select
          options={options}
          value={model.selected === undefined ? undefined : encodeChoiceValue(model.selected)}
          onValueChange={(controlValue) => {
            const variant = model.variants.find(
              (candidate) => encodeChoiceValue(candidate.value) === controlValue,
            );
            const initial = variant && createInitialAuthoringValue(variant.structure);
            if (initial !== undefined) {
              props.onMutation({ kind: 'set', path: model.path, value: initial });
            }
          }}
        />
        {model.value ? (
          <AuthoringEditor
            model={model.value}
            onMutation={props.onMutation}
            renderCustomControl={props.renderCustomControl}
          />
        ) : null}
        {model.optional && model.selected !== undefined ? (
          <Button
            variant="outline"
            onPress={() => props.onMutation({ kind: 'unset', path: model.path })}
          >
            Remove
          </Button>
        ) : null}
      </View>
    </Field>
  );
}

/*** Choose the next unused finite owner identity without assigning collection order semantics. */
function resolveNextFiniteRegistryKey(model: AuthoringEntityRegistryNode): string | undefined {
  if (model.key.kind !== 'choice') return undefined;
  const used = new Set(model.entries.map((entry) => entry.key));
  return model.key.values.find((candidate) => !used.has(candidate));
}

/*** Choose a deterministic unused map key without assigning ordering semantics to persisted values. */
function resolveNextValueMapKey(model: AuthoringValueMapNode): string | undefined {
  const used = new Set(model.entries.map((entry) => entry.key));
  if (model.key.kind === 'choice')
    return model.key.values.find((candidate) => !used.has(candidate));
  return resolveOpenValueMapKey(used);
}

/*** Recursively find the first unused generic key for an open scalar-string value map. */
function resolveOpenValueMapKey(used: ReadonlySet<string>, index = 1): string {
  const candidate = index === 1 ? 'newKey' : `newKey${index}`;
  return used.has(candidate) ? resolveOpenValueMapKey(used, index + 1) : candidate;
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
  model:
    | AuthoringChoiceNode
    | AuthoringEntityRegistryNode
    | AuthoringOrderedListNode
    | AuthoringScalarNode
    | AuthoringSetNode
    | AuthoringUnionNode
    | AuthoringValueMapNode,
): string {
  if (model.kind === 'value-map' || model.kind === 'entity-registry')
    return model.entries.length > 0
      ? model.entries.map((entry) => entry.key).join(', ')
      : 'Not set';
  if (model.kind === 'union')
    return model.selected === undefined ? 'Not set' : String(model.selected);
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
  valueMapRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueMapKey: {
    minWidth: 140,
  },
  valueMapValue: {
    flex: 1,
    minWidth: 180,
  },
  registryAdd: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
