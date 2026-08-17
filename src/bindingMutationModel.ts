import type {
  ComponentDataBinding,
  ComponentDataBindingRegistry,
  EventBinding,
  PropBinding,
  UiNode,
} from '@ankhorage/contracts';

import { deleteOwnProperty } from './utils/deleteOwnProperty';
import { readOwnProperty } from './utils/readOwnProperty';
import { setOwnProperty } from './utils/setOwnProperty';

export function upsertStudioPropBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  propName: string,
  binding: PropBinding,
): ComponentDataBindingRegistry {
  const current = readOwnProperty<ComponentDataBinding>(registry, node.id);
  const props = { ...(current?.props ?? {}) };
  setOwnProperty(props, propName, binding);
  return writeBinding(registry, node, { ...current, props });
}

export function removeStudioPropBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  propName: string,
): ComponentDataBindingRegistry {
  const current = readOwnProperty<ComponentDataBinding>(registry, node.id);
  if (!current?.props || !readOwnProperty<PropBinding>(current.props, propName)) return registry;
  const props = { ...current.props };
  deleteOwnProperty(props, propName);
  return writeBinding(registry, node, { ...current, props });
}

export function appendStudioEventBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  eventName: string,
  binding: EventBinding,
): ComponentDataBindingRegistry {
  const current = readOwnProperty<ComponentDataBinding>(registry, node.id);
  const events = { ...(current?.events ?? {}) };
  const bindings = current?.events
    ? (readOwnProperty<readonly EventBinding[]>(current.events, eventName) ?? [])
    : [];
  setOwnProperty(events, eventName, [...bindings, binding]);
  return writeBinding(registry, node, { ...current, events });
}

export function removeStudioEventBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  eventName: string,
  bindingIndex: number,
): ComponentDataBindingRegistry {
  const current = readOwnProperty<ComponentDataBinding>(registry, node.id);
  const bindings = current?.events
    ? readOwnProperty<readonly EventBinding[]>(current.events, eventName)
    : undefined;
  if (!current || !bindings?.at(bindingIndex)) return registry;
  const events = { ...(current.events ?? {}) };
  const next = bindings.filter((_, index) => index !== bindingIndex);
  if (next.length > 0) setOwnProperty(events, eventName, next);
  else deleteOwnProperty(events, eventName);
  return writeBinding(registry, node, { ...current, events });
}

function writeBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  value: Omit<ComponentDataBinding, 'componentId' | 'componentType'>,
): ComponentDataBindingRegistry {
  const next = { ...registry };
  const binding: ComponentDataBinding = {
    ...value,
    componentId: node.id,
    componentType: node.type,
  };
  if (isEmptyBinding(binding)) deleteOwnProperty(next, node.id);
  else setOwnProperty(next, node.id, binding);
  return next;
}

function isEmptyBinding(binding: ComponentDataBinding): boolean {
  return (
    Object.keys(binding.props ?? {}).length === 0 && Object.keys(binding.events ?? {}).length === 0
  );
}
