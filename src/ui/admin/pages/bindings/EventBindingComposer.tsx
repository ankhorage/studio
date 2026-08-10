import type { EventBinding, UiBindableEventMeta } from '@ankhorage/contracts';
import { Button, Input, Select, Text } from '@ankhorage/zora';
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
import {
  createStudioEventBinding,
  createStudioEventInputDrafts,
  createStudioOperationKey,
  findStudioOperationByKey,
  type StudioEventInputDraft,
  type StudioEventInputSourceKind,
} from './bindingEditorModel';

const TARGET_OPTIONS = [
  { value: 'action', label: 'Action' },
  { value: 'operation', label: 'Data-source operation' },
] as const;
const INPUT_SOURCE_OPTIONS: readonly { value: StudioEventInputSourceKind; label: string }[] = [
  { value: 'event', label: 'Event payload' },
  { value: 'literal', label: 'Literal' },
];
const ACTION_OPTIONS = Object.values(ACTION_REGISTRY).map((action) => ({
  value: action.type,
  label: action.label,
}));

export function EventBindingComposer(props: {
  readonly eventMeta: UiBindableEventMeta;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly onAdd: (binding: EventBinding) => void;
}) {
  const { eventMeta, onAdd, operations } = props;
  const [targetKind, setTargetKind] = useState<'action' | 'operation'>('action');
  const [actionType, setActionType] = useState(ACTION_OPTIONS[0]?.value ?? 'navigate');
  const [operationKey, setOperationKey] = useState(
    operations[0] ? createStudioOperationKey(operations[0]) : '',
  );
  const selectedOperation = findStudioOperationByKey(operations, operationKey);
  const fields = useMemo(
    () =>
      targetKind === 'action'
        ? createStudioActionInputFields(ACTION_REGISTRY[actionType]?.payloadSchema)
        : (selectedOperation?.inputFields ?? []),
    [actionType, selectedOperation?.inputFields, targetKind],
  );
  const eventFields = eventMeta.payload?.fields ?? [];
  const [drafts, setDrafts] = useState<Readonly<Record<string, StudioEventInputDraft>>>({});

  useEffect(() => {
    setDrafts(createStudioEventInputDrafts(fields, eventFields));
  }, [eventFields, fields]);

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
                  value: createStudioOperationKey(operation),
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
          {selectedOperation.sourceLabel}
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
        const draft = props.drafts[field.name] ?? { kind: 'literal' as const, value: '' };
        return (
          <View key={field.name} style={bindingAdminStyles.row}>
            <View style={bindingAdminStyles.grow}>
              <Field label={`${field.label} · ${field.value.type}${field.required ? ' · required' : ''}`}>
                <Select
                  value={draft.kind}
                  options={INPUT_SOURCE_OPTIONS}
                  onValueChange={(kind: StudioEventInputSourceKind) =>
                    props.onChange({ ...props.drafts, [field.name]: { ...draft, kind } })
                  }
                />
              </Field>
            </View>
            <View style={bindingAdminStyles.grow}>
              <Field label={draft.kind === 'event' ? 'Payload path' : 'Literal value'}>
                {draft.kind === 'event' && props.eventFields.length > 0 ? (
                  <Select
                    value={draft.value}
                    options={props.eventFields.map((path) => ({ value: path, label: path }))}
                    onValueChange={(value: string) =>
                      props.onChange({ ...props.drafts, [field.name]: { ...draft, value } })
                    }
                  />
                ) : (
                  <Input
                    value={draft.value}
                    placeholder={draft.kind === 'event' ? 'values.name' : undefined}
                    onChangeText={(value) =>
                      props.onChange({ ...props.drafts, [field.name]: { ...draft, value } })
                    }
                  />
                )}
              </Field>
            </View>
          </View>
        );
      })}
    </View>
  );
}
