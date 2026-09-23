import type { BindingValue, EventBinding, UiBindableEventMeta } from '@ankhorage/contracts';
import { Button, Select, Text, TextInput } from '@ankhorage/zora';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  createStudioActionInputFields,
  type StudioBindingInputFieldOption,
  type StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { AuthoringEditor } from '../../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyAuthoringMutation } from '../../../../features/authoring-engine/application/use-cases/applyAuthoringMutation';
import { deriveAuthoringModel } from '../../../../features/authoring-engine/application/use-cases/deriveAuthoringModel';
import { ACTION_REGISTRY } from '../../../../index';
import type { AuthoringMutation } from '../../../../types/authoring-engine';
import { Field } from '../../adminPagePrimitives';
import { bindingAdminStyles } from './bindingAdminStyles';
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
          props.drafts[field.name] ??
          createStudioEventInputDrafts([field], [])[field.name] ?? {
            kind: 'literal' as const,
            value: '',
            authored: false,
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
                      [field.name]: resolveInputSourceDraft(field, draft, kind),
                    })
                  }
                />
              </Field>
            </View>
            <View style={bindingAdminStyles.grow}>
              <EventInputValueEditor
                field={field}
                draft={draft}
                onChange={(nextDraft) =>
                  props.onChange({ ...props.drafts, [field.name]: nextDraft })
                }
              />
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

/*** Render an event path, DataSchema-backed Authoring Editor, or legacy action literal input. */
function EventInputValueEditor(props: {
  readonly field: StudioBindingInputFieldOption;
  readonly draft: StudioEventInputDraft;
  readonly onChange: (draft: StudioEventInputDraft) => void;
}) {
  const { draft, field } = props;
  if (draft.kind === 'event') {
    return (
      <Field label="Payload path">
        <TextInput
          value={draft.value}
          placeholder="values.name"
          onChangeText={(value) => props.onChange({ kind: 'event', value })}
        />
      </Field>
    );
  }

  if (field.authoring) {
    if (!field.authoring.ok) {
      return (
        <Field label="Literal value">
          <Text color="neutral" emphasis="muted" variant="caption">
            {field.authoring.diagnostic.message}
          </Text>
        </Field>
      );
    }

    const model = deriveAuthoringModel({
      structure: field.authoring.structure,
      value: draft.value,
      label: 'Literal value',
    });
    return (
      <AuthoringEditor
        model={model}
        onMutation={(mutation) =>
          props.onChange({
            kind: 'literal',
            value: applyLiteralMutation(draft.value, mutation),
            authored: true,
          })
        }
      />
    );
  }

  return (
    <Field label="Literal value">
      <TextInput
        value={formatStudioBindingLiteral(draft.value)}
        onChangeText={(value) =>
          props.onChange({
            kind: 'literal',
            value: parseStudioBindingLiteral(value, field.value),
            authored: true,
          })
        }
      />
    </Field>
  );
}

/*** Switch an input draft between event and literal sources without leaking DataSchema defaults into UI code. */
function resolveInputSourceDraft(
  field: StudioBindingInputFieldOption,
  current: StudioEventInputDraft,
  kind: StudioEventInputSourceKind,
): StudioEventInputDraft {
  if (current.kind === kind) return current;
  if (kind === 'event') return { kind: 'event', value: '' };
  return (
    createStudioEventInputDrafts([field], [])[field.name] ?? {
      kind: 'literal',
      value: '',
      authored: false,
    }
  );
}

/*** Apply one neutral authoring mutation to a typed binding literal, handling root scalar/list edits at the binding boundary. */
function applyLiteralMutation(current: BindingValue, mutation: AuthoringMutation): BindingValue {
  if (mutation.path.length === 0) {
    return mutation.kind === 'set' ? mutation.value : current;
  }
  const result = applyAuthoringMutation(current, mutation);
  return result.ok ? result.value : current;
}
