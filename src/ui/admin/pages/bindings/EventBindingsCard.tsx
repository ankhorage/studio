import type {
  ComponentDataBindingRegistry,
  EventBinding,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';
import { Button, Card, Text } from '@ankhorage/zora/reader-free';
import { View } from 'react-native';

import {
  appendStudioEventBinding,
  removeStudioEventBinding,
  resolveStudioBindableEvents,
  type StudioBindingCapabilityOption,
} from '../../../../bindingAuthoringModel';
import { bindingAdminStyles } from './bindingAdminStyles';
import { EventBindingComposer } from './EventBindingComposer';

/*** Render bindable component events, existing event bindings, removal actions, and the composer for new action/operation bindings. */
export function EventBindingsCard(props: {
  readonly componentMeta: UiComponentMetaRegistry;
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly capabilities: readonly StudioBindingCapabilityOption[];
  readonly onChange: (registry: ComponentDataBindingRegistry) => void;
}) {
  const options = resolveStudioBindableEvents(props.node, props.componentMeta);
  const current = props.registry[props.node.id]?.events ?? {};

  return (
    <Card title="Event / action bindings">
      <View style={bindingAdminStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Component events come from ZORA metadata. Bind them to canonical capabilities; Runtime
          remains responsible for execution.
        </Text>
        {options.map((option) => (
          <View key={option.name} style={bindingAdminStyles.stack}>
            <Text weight="semiBold">{option.label}</Text>
            <EventPayloadSummary fields={option.meta.payload?.fields ?? []} />
            {(current[option.name] ?? []).map((binding, index) => (
              <View key={`${option.name}:${index}`} style={bindingAdminStyles.row}>
                <View style={bindingAdminStyles.grow}>
                  <Text variant="bodySmall">{describeEventBinding(binding)}</Text>
                  <Text color="neutral" emphasis="muted" variant="bodySmall">
                    {describeBindingInput(binding.target.input)}
                  </Text>
                </View>
                <Button
                  variant="ghost"
                  color="neutral"
                  onPress={() =>
                    props.onChange(
                      removeStudioEventBinding(props.registry, props.node, option.name, index),
                    )
                  }
                >
                  Remove
                </Button>
              </View>
            ))}
            <EventBindingComposer
              eventMeta={option.meta}
              capabilities={props.capabilities}
              onAdd={(binding) =>
                props.onChange(
                  appendStudioEventBinding(props.registry, props.node, option.name, binding),
                )
              }
            />
            <View style={bindingAdminStyles.divider} />
          </View>
        ))}
        {options.length === 0 ? (
          <Text color="neutral" emphasis="muted">
            This component exposes no bindable events.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/*** Format declared event payload fields as a compact human-readable summary. */
function EventPayloadSummary(props: {
  readonly fields: readonly {
    readonly path: string;
    readonly type: string;
    readonly label?: string;
  }[];
}) {
  return (
    <Text color="neutral" emphasis="muted" variant="bodySmall">
      {props.fields.length > 0
        ? `Payload: ${props.fields.map((field) => `${field.label ?? field.path} (${field.type})`).join(', ')}`
        : 'Payload: none'}
    </Text>
  );
}

/*** Format one canonical event binding target for administration display. */
function describeEventBinding(binding: EventBinding): string {
  return `Capability · ${binding.target.capability}`;
}

/*** Format the keys of an event binding's input map for administration display. */
function describeBindingInput(input: EventBinding['target']['input']): string {
  const keys = Object.keys(input ?? {});
  return keys.length > 0 ? `Inputs: ${keys.join(', ')}` : 'No mapped inputs';
}
