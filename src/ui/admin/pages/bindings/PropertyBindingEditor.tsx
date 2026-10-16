import type { PropBinding } from '@ankhorage/contracts';
import { Button, Select, Text, TextInput } from '@ankhorage/zora';
import { View } from 'react-native';

import {
  assessStudioBindingCompatibility,
  type StudioBindablePropOption,
  type StudioBindingCapabilityOption,
} from '../../../../bindingAuthoringModel';
import { Field } from '../../adminPagePrimitives';
import { bindingAdminStyles } from './bindingAdminStyles';
import {
  createStudioPropBindingForSource,
  findStudioBindingCapabilityById,
  formatStudioBindingLiteral,
  parseStudioBindingLiteral,
  STUDIO_BINDING_SOURCE_OPTIONS,
  type StudioBindingSourceKind,
} from './bindingEditorModel';

/*** Render source-kind selection and source-specific editors for one bindable component property. */
export function PropertyBindingEditor(props: {
  readonly option: StudioBindablePropOption;
  readonly binding: PropBinding | undefined;
  readonly capabilities: readonly StudioBindingCapabilityOption[];
  readonly onChange: (binding: PropBinding) => void;
  readonly onRemove: () => void;
}) {
  const { binding, capabilities, onChange, onRemove, option } = props;
  const apiCapabilities = capabilities.filter((entry) => entry.capability.id.startsWith('api.'));
  const capabilityOptions = apiCapabilities.map((entry) => ({
    value: entry.capability.id,
    label: entry.label,
  }));
  const sourceKind = resolveStudioBindingSourceKind(binding);

  return (
    <View style={bindingAdminStyles.stack}>
      <View style={bindingAdminStyles.row}>
        <View style={bindingAdminStyles.grow}>
          <Field label={`${option.label} · ${option.meta.value.type}`}>
            <Select
              value={sourceKind}
              options={STUDIO_BINDING_SOURCE_OPTIONS}
              onValueChange={(kind: StudioBindingSourceKind) =>
                onChange(createStudioPropBindingForSource(kind, option.meta.value, capabilities))
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
          capabilities={apiCapabilities}
          capabilityOptions={capabilityOptions}
          onChange={onChange}
        />
      ) : (
        <Button
          variant="soft"
          onPress={() =>
            onChange(createStudioPropBindingForSource('literal', option.meta.value, capabilities))
          }
        >
          Add binding
        </Button>
      )}
    </View>
  );
}

/*** Render literal, state/context, or operation-response fields for one existing property binding source. */
function PropertyBindingSourceFields(props: {
  readonly binding: PropBinding;
  readonly expected: StudioBindablePropOption['meta']['value'];
  readonly capabilities: readonly StudioBindingCapabilityOption[];
  readonly capabilityOptions: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (binding: PropBinding) => void;
}) {
  const { binding, capabilities, capabilityOptions, expected, onChange } = props;
  const { value } = binding;

  if (isLiteralExpression(value)) {
    if (expected.type === 'boolean') {
      return (
        <Select
          value={String(value.value === true)}
          options={[
            { value: 'false', label: 'False' },
            { value: 'true', label: 'True' },
          ]}
          onValueChange={(nextValue: string) =>
            onChange({ ...binding, value: { kind: 'literal', value: nextValue === 'true' } })
          }
        />
      );
    }
    return (
      <TextInput
        value={formatStudioBindingLiteral(value.value)}
        onChangeText={(value) =>
          onChange({
            ...binding,
            value: { kind: 'literal', value: parseStudioBindingLiteral(value, expected) },
          })
        }
      />
    );
  }

  if (!isCapabilityReference(value)) {
    return <Text color="danger">This expression cannot be edited as a property reference.</Text>;
  }

  if (value.capability.startsWith('state.') || value.capability.startsWith('context.')) {
    const kind = value.capability.startsWith('state.') ? 'state' : 'context';
    return (
      <TextInput
        value={value.capability.slice(`${kind}.`.length)}
        placeholder={kind === 'state' ? 'draft.customer.name' : 'session.user.name'}
        onChangeText={(path) => onChange({ ...binding, value: { capability: `${kind}.${path}` } })}
      />
    );
  }

  const capability = findStudioBindingCapabilityById(capabilities, value.capability);
  const responseOptions = (capability?.responsePaths ?? []).map((response) => {
    const compatibility = assessStudioBindingCompatibility(expected, response.value);
    return {
      value: response.path,
      label: `${response.label} · ${response.value.type}${compatibility === 'incompatible' ? ' · incompatible' : ''}`,
    };
  });

  return (
    <View style={bindingAdminStyles.stack}>
      <Field label="API capability">
        <Select
          value={value.capability}
          options={capabilityOptions}
          onValueChange={(id: string) => {
            const selected = findStudioBindingCapabilityById(capabilities, id);
            if (!selected) return;
            onChange({
              ...binding,
              value: {
                capability: selected.capability.id,
                path: selected.responsePaths[0]?.path,
              },
            });
          }}
        />
      </Field>
      <Field label="Response path">
        <Select
          value={value.path ?? ''}
          options={responseOptions}
          onValueChange={(path: string) => onChange({ ...binding, value: { ...value, path } })}
        />
      </Field>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {capability?.apiLabel ?? 'The referenced capability is currently unavailable.'}
      </Text>
    </View>
  );
}

/*** Classify the current expression for the property binding source picker. */
function resolveStudioBindingSourceKind(binding: PropBinding | undefined): StudioBindingSourceKind {
  if (!binding || isLiteralExpression(binding.value)) return 'literal';
  if (!isCapabilityReference(binding.value)) return 'literal';
  if (binding.value.capability.startsWith('state.')) return 'state';
  if (binding.value.capability.startsWith('context.')) return 'context';
  return 'api';
}

/*** Narrow a binding expression to the literal variant rendered by this editor. */
function isLiteralExpression(
  value: PropBinding['value'],
): value is Extract<PropBinding['value'], { readonly kind: 'literal' }> {
  return 'kind' in value && value.kind === 'literal';
}

/*** Narrow a binding expression to the capability-reference form owned by this editor. */
function isCapabilityReference(
  value: PropBinding['value'],
): value is Extract<PropBinding['value'], { readonly capability: string }> {
  return 'capability' in value;
}
