import type { EventBinding, UiBindableEventMeta } from '@ankhorage/contracts';
import { Button, Select, Text, TextInput } from '@ankhorage/zora/reader-free';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  type StudioBindingCapabilityOption,
  type StudioBindingInputFieldOption,
} from '../../../../bindingAuthoringModel';
import { Field } from '../../adminPagePrimitives';
import { bindingAdminStyles } from './bindingAdminStyles';
import {
  createStudioEventBinding,
  createStudioEventInputDrafts,
  findStudioBindingCapabilityById,
  formatStudioBindingLiteral,
  parseStudioBindingLiteral,
  type StudioEventInputDraft,
  type StudioEventInputSourceKind,
} from './bindingEditorModel';
import { BindingLiteralAuthoringEditor } from './BindingLiteralAuthoringEditor';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';

const INPUT_SOURCE_OPTIONS: readonly { value: StudioEventInputSourceKind; label: string }[] = [
  { value: 'event', label: 'Event payload' },
  { value: 'literal', label: 'Literal' },
];
/*** Compose a canonical capability invocation from component event payload or literal inputs. */
export function EventBindingComposer(props: {
  readonly eventMeta: UiBindableEventMeta;
  readonly capabilities: readonly StudioBindingCapabilityOption[];
  readonly onAdd: (binding: EventBinding) => void;
}) {
  const { capabilities, eventMeta, onAdd } = props;
  const [capabilityId, setCapabilityId] = useState(capabilities[0]?.capability.id ?? '');
  const selectedCapability = findStudioBindingCapabilityById(capabilities, capabilityId);
  const fields = useMemo(
    () => selectedCapability?.inputFields ?? [],
    [selectedCapability?.inputFields],
  );
  const eventFields = useMemo(() => eventMeta.payload?.fields ?? [], [eventMeta.payload?.fields]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, StudioEventInputDraft>>>({});

  useEffect(() => {
    setDrafts(createStudioEventInputDrafts(fields, eventFields));
  }, [eventFields, fields]);

  /*** Build and emit the current event binding when its selected target can be resolved. */
  const add = () => {
    if (!selectedCapability || !isCapabilityId(eventMeta.payload?.eventType)) return;
    onAdd(
      createStudioEventBinding({
        target: { capability: selectedCapability.capability.id },
        eventCapability: eventMeta.payload.eventType,
        fields,
        drafts,
      }),
    );
  };

  return (
    <View style={bindingAdminStyles.stack}>
      <View style={bindingAdminStyles.row}>
        <View style={bindingAdminStyles.grow}>
          <Field label="Capability">
            <Select
              value={capabilityId}
              options={capabilities.map((capability) => ({
                value: capability.capability.id,
                label: capability.label,
              }))}
              onValueChange={setCapabilityId}
            />
          </Field>
        </View>
      </View>
      {selectedCapability ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          {selectedCapability.apiLabel}
        </Text>
      ) : null}
      <EventInputDrafts
        fields={fields}
        eventFields={eventFields.map((field) => field.path)}
        drafts={drafts}
        onChange={setDrafts}
      />
      <Button
        disabled={!selectedCapability || !isCapabilityId(eventMeta.payload?.eventType)}
        onPress={add}
      >
        Add binding
      </Button>
    </View>
  );
}

/*** Confirm that component metadata supplies a Contracts capability identifier. */
function isCapabilityId(value: string | undefined): value is `${string}.${string}` {
  return value?.includes('.') ?? false;
}

/*** Render editors for each declared target input and let each input choose event-payload or literal sourcing. */
function EventInputDrafts(props: {
  readonly fields: readonly StudioBindingInputFieldOption[];
  readonly eventFields: readonly string[];
  readonly drafts: Readonly<Record<string, StudioEventInputDraft>>;
  readonly onChange: (drafts: Readonly<Record<string, StudioEventInputDraft>>) => void;
}) {
  if (props.fields.length === 0) {
    return (
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        This target has no declared inputs.
      </Text>
    );
  }

  return (
    <View style={bindingAdminStyles.stack}>
      {props.fields.map((field) => {
        const draft = props.drafts[field.name] ?? {
          kind: 'literal' as const,
          value: createBindingLiteralDefaultValue(field),
          included: field.required,
        };
        return (
          <View key={field.name} style={bindingAdminStyles.row}>
            <View style={bindingAdminStyles.grow}>
              <Field
                label={`${field.label} · ${field.value.type}${field.required ? ' · required' : ''}`}
              >
                <Select
                  value={draft.kind}
                  options={INPUT_SOURCE_OPTIONS}
                  onValueChange={(kind: StudioEventInputSourceKind) =>
                    props.onChange({
                      ...props.drafts,
                      [field.name]:
                        kind === 'event'
                          ? {
                              kind,
                              value: props.eventFields.includes(field.name) ? field.name : '',
                            }
                          : {
                              kind,
                              value: createBindingLiteralDefaultValue(field),
                              included: true,
                            },
                    })
                  }
                />
              </Field>
            </View>
            <View style={bindingAdminStyles.grow}>
              {draft.kind === 'event' ? (
                <Field label="Payload path">
                  <TextInput
                    value={draft.value}
                    placeholder="values.name"
                    onChangeText={(value) =>
                      props.onChange({
                        ...props.drafts,
                        [field.name]: { kind: 'event', value },
                      })
                    }
                  />
                </Field>
              ) : field.authoring ? (
                <BindingLiteralAuthoringEditor
                  label="Literal value"
                  required={field.required}
                  structure={field.authoring}
                  value={draft.value}
                  onChange={(value) =>
                    props.onChange({
                      ...props.drafts,
                      [field.name]: {
                        kind: 'literal',
                        value,
                        included: value !== undefined,
                      },
                    })
                  }
                />
              ) : (
                <Field label="Literal value">
                  <TextInput
                    value={
                      !draft.included && !field.required
                        ? ''
                        : draft.value === undefined
                          ? ''
                          : formatStudioBindingLiteral(draft.value)
                    }
                    onChangeText={(value) =>
                      props.onChange({
                        ...props.drafts,
                        [field.name]: {
                          kind: 'literal',
                          value: parseStudioBindingLiteral(value, field.value),
                          included: field.required || value !== '',
                        },
                      })
                    }
                  />
                </Field>
              )}
            </View>
          </View>
        );
      })}
      {props.eventFields.length > 0 ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Known payload paths: {props.eventFields.join(', ')}. Nested paths may be entered manually.
        </Text>
      ) : null}
    </View>
  );
}
