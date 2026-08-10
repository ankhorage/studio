import type {
  ComponentDataBinding,
  ComponentDataBindingRegistry,
  EventBinding,
  PropBinding,
  UiNode,
} from '@ankhorage/contracts';

export function upsertStudioPropBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  propName: string,
  binding: PropBinding,
): ComponentDataBindingRegistry {
  const current = registry[node.id];
  return writeBinding(registry, node, {
    ...current,
    props: { ...(current?.props ?? {}), [propName]: binding },
  });
}

export function removeStudioPropBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  propName: string,
): ComponentDataBindingRegistry {
  const current = registry[node.id];
  if (!current?.props?.[propName]) return registry;
  const props = { ...current.props };
  delete props[propName];
  return writeBinding(registry, node, { ...current, props });
}

export function appendStudioEventBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  eventName: string,
  binding: EventBinding,
): ComponentDataBindingRegistry {
  const current = registry[node.id];
  return writeBinding(registry, node, {
    ...current,
    events: {
      ...(current?.events ?? {}),
      [eventName]: [...(current?.events?.[eventName] ?? []), binding],
    },
  });
}

export function removeStudioEventBinding(
  registry: ComponentDataBindingRegistry,
  node: UiNode,
  eventName: string,
  bindingIndex: number,
): ComponentDataBindingRegistry {
  const current = registry[node.id];
  const bindings = current?.events?.[eventName];
  if (!bindings?.[bindingIndex]) return registry;
  const events = { ...(current.events ?? {}) };
  const next = bindings.filter((_, index) => index !== bindingIndex);
  if (next.length > 0) events[eventName] = next;
  else delete events[eventName];
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
  if (isEmptyBinding(binding)) delete next[node.id];
  else next[node.id] = binding;
  return next;
}

function isEmptyBinding(binding: ComponentDataBinding): boolean {
  return Object.keys(binding.props ?? {}).length === 0 && Object.keys(binding.events ?? {}).length === 0;
}
