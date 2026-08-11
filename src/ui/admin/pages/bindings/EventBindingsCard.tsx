import type { ComponentDataBindingRegistry, UiNode } from '@ankhorage/contracts';
import { Button, Card, Text, ZORA_BINDABLE_COMPONENT_META } from '@ankhorage/zora';
import { View } from 'react-native';

import {
  appendStudioEventBinding,
  removeStudioEventBinding,
  resolveStudioBindableEvents,
  type StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { bindingAdminStyles } from './bindingAdminStyles';
import { EventBindingComposer } from './EventBindingComposer';

export function EventBindingsCard(props: {
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly onChange: (registry: ComponentDataBindingRegistry) => void;
}) {
  const options = resolveStudioBindableEvents(props.node, ZORA_BINDABLE_COMPONENT_META);
  const current = props.registry[props.node.id]?.events ?? {};

  return (
    <Card title="Event / action bindings">
      <View style={bindingAdminStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Component events come from ZORA metadata. Bind them to canonical actions or data-source
          operations; Runtime remains responsible for execution.
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
                    {describeBindingInput(binding.input)}
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
              operations={props.operations}
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

function describeEventBinding(binding: {
  readonly target:
    | { readonly kind: 'action'; readonly type: string }
    | {
        readonly kind: 'operation';
        readonly operation: {
          readonly dataSourceId: string;
          readonly endpointId?: string;
          readonly operationId: string;
        };
      };
  readonly input?: Readonly<Record<string, unknown>>;
}): string {
  if (binding.target.kind === 'action') return `Action · ${binding.target.type}`;
  const { dataSourceId, endpointId, operationId } = binding.target.operation;
  return `Operation · ${dataSourceId} · ${endpointId ?? '<auto>'} · ${operationId}`;
}

function describeBindingInput(input: Readonly<Record<string, unknown>> | undefined): string {
  const keys = Object.keys(input ?? {});
  return keys.length > 0 ? `Inputs: ${keys.join(', ')}` : 'No mapped inputs';
}
