import type { UiComponentMetaRegistry, UiNode } from '@ankhorage/contracts';

import type {
  StudioBindableEventOption,
  StudioBindablePropOption,
} from './bindingAuthoringContracts';

export function resolveStudioBindableProps(
  node: UiNode,
  registry: UiComponentMetaRegistry,
): readonly StudioBindablePropOption[] {
  const props = registry[node.type]?.bindings?.props ?? {};

  return Object.entries(props).map(([name, meta]) => ({
    name,
    label: meta.label ?? name,
    meta,
  }));
}

export function resolveStudioBindableEvents(
  node: UiNode,
  registry: UiComponentMetaRegistry,
): readonly StudioBindableEventOption[] {
  const events = registry[node.type]?.bindings?.events ?? {};

  return Object.entries(events).map(([name, meta]) => ({
    name,
    label: meta.label ?? name,
    meta,
  }));
}
