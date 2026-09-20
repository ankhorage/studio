import { Button, Field, Select, Switch, Text, TextInput } from '@ankhorage/zora';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  AuthoringChoiceNode,
  AuthoringMutation,
  AuthoringNode,
  AuthoringScalarNode,
} from '../../../../types/authoring-engine';

export interface AuthoringEditorProps {
  readonly model: AuthoringNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}

/*** Render one neutral authoring model with ZORA controls without owning product-specific schema. */
export function AuthoringEditor({ model, onMutation }: AuthoringEditorProps) {
  const { inheritance } = model;
  if (!inheritance || !model.optional || model.readOnly) {
    return <AuthoringControl model={model} onMutation={onMutation} />;
  }

  return (
    <View style={styles.fields}>
      <AuthoringControl model={model} onMutation={onMutation} />
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
function AuthoringControl({ model, onMutation }: AuthoringEditorProps) {
  if (model.kind === 'object') {
    return (
      <View style={styles.fields}>
        {model.fields.map((field) => (
          <AuthoringEditor key={field.path.join('.')} model={field} onMutation={onMutation} />
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
        <Text>{formatAuthoringValue(model.value)}</Text>
      </Field>
    );
  }

  if (model.kind === 'choice') {
    return <ChoiceEditor model={model} onMutation={onMutation} />;
  }

  return <ScalarEditor model={model} onMutation={onMutation} />;
}

/*** Render a supported finite string choice while keeping unsupported choice primitives explicit. */
function ChoiceEditor(props: {
  readonly model: AuthoringChoiceNode;
  readonly onMutation: (mutation: AuthoringMutation) => void;
}) {
  const { model } = props;
  if (!model.values.every((value) => typeof value === 'string')) {
    return (
      <Field label={model.label}>
        <Text color="neutral" emphasis="muted" variant="caption">
          Non-string finite choices are not supported by this presentation adapter yet.
        </Text>
      </Field>
    );
  }

  const { values } = model;
  const options = values.map((value) => ({ label: value, value }));
  const effective = model.value === undefined ? model.inheritance?.value : model.value;
  const current = typeof effective === 'string' ? effective : undefined;

  return (
    <Field label={model.label} description={model.description} required={!model.optional}>
      <Select
        options={options}
        value={current}
        onValueChange={(value) => props.onMutation({ kind: 'set', path: model.path, value })}
      />
    </Field>
  );
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

/*** Format one authored primitive for read-only presentation. */
function formatAuthoringValue(value: AuthoringScalarNode['value']) {
  if (value === undefined) return 'Not set';
  if (value === null) return 'null';
  return String(value);
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
});
