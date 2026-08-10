import type { PropBinding } from '@ankhorage/contracts';
import { Button, Input, Select, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import {
  assessStudioBindingCompatibility,
  type StudioBindablePropOption,
  type StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { Field } from '../../adminPagePrimitives';
import { bindingAdminStyles } from './bindingAdminStyles';
import {
  createStudioOperationKey,
  createStudioPropBindingForSource,
  findStudioOperationByKey,
  formatStudioBindingLiteral,
  parseStudioBindingLiteral,
  STUDIO_BINDING_SOURCE_OPTIONS,
  type StudioBindingSourceKind,
} from './bindingEditorModel';

export function PropertyBindingEditor(props: {
  readonly option: StudioBindablePropOption;
  readonly binding: PropBinding | undefined;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly onChange: (binding: PropBinding) => void;
  readonly onRemove: () => void;
}) {
  const { binding, onChange, onRemove, option, operations } = props;
  const operationOptions = operations.map((operation) => ({
    value: createStudioOperationKey(operation.operation),
    label: operation.label,
  }));
  const sourceKind = binding?.source.kind ?? 'literal';

  return (
    <View style={bindingAdminStyles.stack}>
      <View style={bindingAdminStyles.row}>
        <View style={bindingAdminStyles.grow}>
          <Field label={`${option.label} · ${option.meta.value.type}`}>
            <Select
              value={sourceKind}
              options={STUDIO_BINDING_SOURCE_OPTIONS}
              onValueChange={(kind: StudioBindingSourceKind) =>
                onChange(createStudioPropBindingForSource(kind, option.meta.value, operations))
              }
            />
          </Field>
        </View>
        {binding ? (
          <Button variant="ghost" color="neutral" onPress={onRemove}>
            Remove
          </Button>
        ) : null}
      </View>
      {binding ? (
        <PropertyBindingSourceFields
          binding={binding}
          expected={option.meta.value}
          operations={operations}
          operationOptions={operationOptions}
          onChange={onChange}
        />
      ) : (
        <Button
          variant="soft"
          onPress={() =>
            onChange(createStudioPropBindingForSource('literal', option.meta.value, operations))
          }
        >
          Add binding
        </Button>
      )}
    </View>
  );
}

function PropertyBindingSourceFields(props: {
  readonly binding: PropBinding;
  readonly expected: StudioBindablePropOption['meta']['value'];
  readonly operations: readonly StudioBindingOperationOption[];
  readonly operationOptions: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (binding: PropBinding) => void;
}) {
  const { binding, expected, onChange, operationOptions, operations } = props;
  const { source } = binding;

  if (source.kind === 'literal') {
    if (expected.type === 'boolean') {
      return (
        <Select
          value={String(source.value === true)}
          options={[
            { value: 'false', label: 'False' },
            { value: 'true', label: 'True' },
          ]}
          onValueChange={(value: string) =>
            onChange({ ...binding, source: { kind: 'literal', value: value === 'true' } })
          }
        />
      );
    }
    return (
      <Input
        value={formatStudioBindingLiteral(source.value)}
        onChangeText={(value) =>
          onChange({
            ...binding,
            source: { kind: 'literal', value: parseStudioBindingLiteral(value, expected) },
          })
        }
      />
    );
  }

  if (source.kind === 'state' || source.kind === 'context') {
    return (
      <Input
        value={source.path}
        placeholder={source.kind === 'state' ? 'draft.customer.name' : 'session.user.name'}
        onChangeText={(path) => onChange({ ...binding, source: { ...source, path } })}
      />
    );
  }

  if (source.kind === 'event') {
    return <Text color="danger">Event sources are not available for persistent property bindings.</Text>;
  }

  const operationKey = createStudioOperationKey(source.operation);
  const operation = findStudioOperationByKey(operations, operationKey);
  const responseOptions = (operation?.responsePaths ?? []).map((response) => {
    const compatibility = assessStudioBindingCompatibility(expected, response.value);
    return {
      value: response.path,
      label: `${response.label} · ${response.value.type}${compatibility === 'incompatible' ? ' · incompatible' : ''}`,
    };
  });

  return (
    <View style={bindingAdminStyles.stack}>
      <Field label="Operation">
        <Select
          value={operationKey}
          options={operationOptions}
          onValueChange={(key: string) => {
            const selected = findStudioOperationByKey(operations, key);
            if (!selected) return;
            onChange({
              ...binding,
              source: {
                kind: 'operation',
                operation: selected.operation,
                path: selected.responsePaths[0]?.path,
              },
            });
          }}
        />
      </Field>
      <Field label="Response path">
        <Select
          value={source.path ?? ''}
          options={responseOptions}
          onValueChange={(path: string) => onChange({ ...binding, source: { ...source, path } })}
        />
      </Field>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {operation?.sourceLabel ?? 'The referenced operation is currently unavailable.'}
      </Text>
    </View>
  );
}
