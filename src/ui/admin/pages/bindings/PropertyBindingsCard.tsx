import type { ComponentDataBindingRegistry, UiNode } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import {
  removeStudioPropBinding,
  resolveStudioBindableProps,
  upsertStudioPropBinding,
  type StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { ZORA_BINDABLE_COMPONENT_META } from '@ankhorage/zora';
import { bindingAdminStyles } from './bindingAdminStyles';
import { PropertyBindingEditor } from './PropertyBindingEditor';

export function PropertyBindingsCard(props: {
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly onChange: (registry: ComponentDataBindingRegistry) => void;
}) {
  const options = resolveStudioBindableProps(props.node, ZORA_BINDABLE_COMPONENT_META);
  const current = props.registry[props.node.id]?.props ?? {};

  return (
    <Card title="Property / data bindings">
      <View style={bindingAdminStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Bind only properties explicitly exposed by ZORA metadata to literals, state, context, or
          canonical operation responses.
        </Text>
        {options.map((option) => (
          <View key={option.name} style={bindingAdminStyles.stack}>
            <PropertyBindingEditor
              option={option}
              binding={current[option.name]}
              operations={props.operations}
              onChange={(binding) =>
                props.onChange(
                  upsertStudioPropBinding(props.registry, props.node, option.name, binding),
                )
              }
              onRemove={() =>
                props.onChange(removeStudioPropBinding(props.registry, props.node, option.name))
              }
            />
            <View style={bindingAdminStyles.divider} />
          </View>
        ))}
        {options.length === 0 ? (
          <Text color="neutral" emphasis="muted">
            This component exposes no bindable properties.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
