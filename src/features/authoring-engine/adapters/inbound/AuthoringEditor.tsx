import { Field, Input, Select, Switch, Text } from '@ankhorage/zora';
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
  if (model.kind === 'object') {
    return (
      <View style={styles.fields}>
        {model.fields.map((field) => (
          <AuthoringEditor
            key={field.path.join('.')}
            model={field}
            onMutation={onMutation}
          />
        ))}
      </View>
    );
  }

  if (model.kind === 'unsupported') {
    return (
      <Field label={model.label}>
        <Text color="neutral" emphasis="muted" variant="caption">
          {model.diagnostic.message}
        </Text>
      </Field>
    );
  }

  if (model.readOnly) {
    return (
      <Field label={model.label}>
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

  const values = model.values as readonly string[];
  const options = values.map((value) => ({ label: value, value }));
  const current = typeof model.value === 'string' ? model.value : undefined;

  return (
    <Field label={model.label}>
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
      <Field label={model.label}>
        <Switch
          value={model.value === true}
          onValueChange={(value) =>
            props.onMutation({ kind: 'set', path: model.path, value })
          }
        />
      </Field>
    );
  }

  if (model.scalarType === 'null') {
    return (
      <Field label={model.label}>
        <Text>null</Text>
      </Field>
    );
  }

  const value =
    typeof model.value === 'number' || typeof model.value === 'string'
      ? String(model.value)
      : '';
  const numeric = model.scalarType === 'integer' || model.scalarType === 'number';

  return (
    <Field label={model.label}>
      <Input
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
function formatAuthoringValue(value: AuthoringScalarNode['value'] | AuthoringChoiceNode['value']) {
  if (value === undefined) return 'Not set';
  if (value === null) return 'null';
  return String(value);
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
});
