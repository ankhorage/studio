import type { EventBinding, UiBindableEventMeta } from '@ankhorage/contracts';
import { Button, Select, Text, TextInput } from '@ankhorage/zora';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  createStudioActionInputFields,
  type StudioBindingInputFieldOption,
  type StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { ACTION_REGISTRY } from '../../../../index';
import { Field } from '../../adminPagePrimitives';
import { bindingAdminStyles } from './bindingAdminStyles';
import { BindingLiteralAuthoringEditor } from './BindingLiteralAuthoringEditor';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';
import {
  createStudioEventBinding,
  createStudioEventInputDrafts,
  createStudioOperationKey,
  findStudioOperationByKey,
  formatStudioBindingLiteral,
  parseStudioBindingLiteral,
  type StudioEventInputDraft,
  type StudioEventInputSourceKind,
} from './bindingEditorModel';

const TARGET_OPTIONS = [
  { value: 'action', label: 'Action' },
  { value: 'operation', label: 'API operation' },
] as const;
const INPUT_SOURCE_OPTIONS: readonly { value: StudioEventInputSourceKind; label: string }[] = [
  { value: 'event', label: 'Event payload' },
  { value: 'literal', label: 'Literal' },
];
const ACTION_OPTIONS = Object.values(ACTION_REGISTRY).map((action) => ({
  value: action.type,
  label: action.label,
}));

/*** Compose a new event binding by selecting an action/API target and authoring its input mappings from event payload or literal values. */
export function EventBindingComposer(props: {
  readonly eventMeta: UiBindableEventMeta;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly onAdd: (binding: EventBinding) => void;
}) {
  const { eventMeta, onAdd, operations } = props;
  const [targetKind, setTargetKind] = useState<'action' | 'operation'>('action');
  const [actionType, setActionType] = useState(ACTION_OPTIONS[0]?.value ?? 'navigate');
  const [operationKey, setOperationKey] = useState(
    operations[0] ? createStudioOperationKey(operations[0].operation) : '',
  );
  const selectedOperation = findStudioOperationByKey(operations, operationKey);
  const fields = useMemo(
    () =>
      targetKind === 'action'
        ? createStudioActionInputFields(ACTION_REGISTRY[actionType]?.payloadSchema)
        : (selectedOperation?.inputFields ?? []),
    [actionType, selectedOperation?.inputFields, targetKind],
  );
  const eventFields = useMemo(() => eventMeta.payload?.fields ?? [], [eventMeta.payload?.fields]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, StudioEventInputDraft>>>({});

  useEffect(() => {
    setDrafts(createStudioEventInputDrafts(fields, eventFields));
  }, [eventFields, fields]);

  /*** Build and emit the current event binding when its selected target can be resolved. */
  const add = () => {
    const target =
      targetKind === 'action'
        ? ({ kind: 'action', type: actionType } as const)
        : selectedOperation
          ? ({ kind: 'operation', operation: selectedOperation.operation } as const)
          : null;
    if (!target) return;
    onAdd(createStudioEventBinding({ target, fields, drafts }));
  };

  return (
    <View style={bindingAdminStyles.stack}>
      <View style={bindingAdminStyles.row}>
        <View style={bindingAdminStyles.grow}>
          <Field label="Target kind">
            <Select value={targetKind} options={TARGET_OPTIONS} onValueChange={setTargetKind} />
          </Field>
        </View>
        <View style={bindingAdminStyles.grow}>
          {targetKind === 'action' ? (
            <Field label="Action">
              <Select value={actionType} options={ACTION_OPTIONS} onValueChange={setActionType} />
            </Field>
          ) : (
            <Field label="Operation">
              <Select
                value={operationKey}
                options={operations.map((operation) => ({
                  value: createStudioOperationKey(operation.operation),
                  label: operation.label,
                }))}
                onValueChange={setOperationKey}
              />
            </Field>
          )}
        </View>
      </View>
      {targetKind === 'operation' && selectedOperation ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          {selectedOperation.apiLabel}
        </Text>
      ) : null}
      <EventInputDrafts
        fields={fields}
        eventFields={eventFields.map((field) => field.path)}
        drafts={drafts}
        onChange={setDrafts}
      />
      <Button disabled={targetKind === 'operation' && !selectedOperation} onPress={add}>
        Add binding
      </Button>
    </View>
  );
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
        const draft =
          props.drafts[field.name] ?? {
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
