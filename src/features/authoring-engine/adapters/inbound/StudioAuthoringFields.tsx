import { Select, Switch, Text, TextInput, View } from '@ankhorage/zora';
import React from 'react';

import type {
  StudioAuthoringChoiceField,
  StudioAuthoringField,
  StudioAuthoringNode,
  StudioAuthoringNumberField,
  StudioAuthoringObjectNode,
} from '../../domain/authoringTypes';

export interface StudioAuthoringFieldsProps {
  readonly node: StudioAuthoringNode;
  readonly onChange: (field: StudioAuthoringField, value: unknown) => void;
}

/*** Render a neutral authoring node through canonical ZORA controls without owning domain semantics. */
export function StudioAuthoringFields({ node, onChange }: StudioAuthoringFieldsProps) {
  if (node.kind === 'object') {
    return <StudioAuthoringObjectFields node={node} onChange={onChange} />;
  }
  if (node.kind === 'unsupported') {
    return (
      <View gap="xs">
        <Text weight="semiBold">{node.label}</Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {node.diagnostic.message}
        </Text>
      </View>
    );
  }
  if (node.kind === 'text') {
    return (
      <AuthoringFieldLabel field={node}>
        {node.readOnly ? (
          <Text>{node.value ?? 'Not set'}</Text>
        ) : (
          <TextInput
            accessibilityLabel={node.label}
            value={node.value ?? ''}
            multiline={node.multiline}
            onChangeText={(value) =>
              onChange(node, node.optional && value.length === 0 ? undefined : value)
            }
          />
        )}
      </AuthoringFieldLabel>
    );
  }
  if (node.kind === 'number') {
    return (
      <AuthoringFieldLabel field={node}>
        <TextInput
          accessibilityLabel={node.label}
          editable={!node.readOnly}
          keyboardType="numeric"
          value={node.value === undefined ? '' : String(node.value)}
          onChangeText={(value) => changeNumber(node, value, onChange)}
        />
      </AuthoringFieldLabel>
    );
  }
  if (node.kind === 'boolean') {
    return (
      <AuthoringFieldLabel field={node}>
        <Switch
          checked={node.value ?? false}
          disabled={node.readOnly}
          onCheckedChange={(value: boolean) => onChange(node, value)}
        />
      </AuthoringFieldLabel>
    );
  }

  return (
    <AuthoringFieldLabel field={node}>
      <Select
        value={encodeChoice(node.value)}
        options={node.options.map((value) => ({
          value: encodeChoice(value),
          label: formatChoice(value),
        }))}
        disabled={node.readOnly}
        onValueChange={(value) => changeChoice(node, value, onChange)}
      />
    </AuthoringFieldLabel>
  );
}

/*** Render all visible child fields of one object authoring node with shared responsive spacing. */
function StudioAuthoringObjectFields(props: {
  readonly node: StudioAuthoringObjectNode;
  readonly onChange: StudioAuthoringFieldsProps['onChange'];
}) {
  return (
    <View gap="m">
      {props.node.fields.map((field) => (
        <StudioAuthoringFields key={field.id} node={field} onChange={props.onChange} />
      ))}
    </View>
  );
}

/*** Render one semantic label/description wrapper without encoding any field-type policy. */
function AuthoringFieldLabel(props: {
  readonly field: StudioAuthoringField;
  readonly children: React.ReactNode;
}) {
  return (
    <View gap="xs">
      <Text variant="bodySmall" weight="semiBold">
        {props.field.label}
        {props.field.optional ? '' : ' *'}
      </Text>
      {props.field.description ? (
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.field.description}
        </Text>
      ) : null}
      {props.children}
    </View>
  );
}

/*** Parse a numeric text draft only when it represents a valid authoring mutation. */
function changeNumber(
  field: StudioAuthoringNumberField,
  value: string,
  onChange: StudioAuthoringFieldsProps['onChange'],
): void {
  if (value.length === 0 && field.optional) {
    onChange(field, undefined);
    return;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) onChange(field, numeric);
}

/*** Resolve a serialized select option back to the exact canonical literal choice. */
function changeChoice(
  field: StudioAuthoringChoiceField,
  encoded: string,
  onChange: StudioAuthoringFieldsProps['onChange'],
): void {
  const option = field.options.find((value) => encodeChoice(value) === encoded);
  if (option !== undefined) onChange(field, option);
}

/*** Encode scalar literal identity for a string-only Select value boundary. */
function encodeChoice(value: StudioAuthoringChoiceField['value']): string {
  return value === undefined ? '' : JSON.stringify(value);
}

/*** Format one canonical scalar choice for human-readable ZORA option text. */
function formatChoice(value: StudioAuthoringChoiceField['options'][number]): string {
  if (value === null) return 'Null';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
