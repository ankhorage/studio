import type { UiComponentMetaRegistry, UiNode } from '@ankhorage/contracts';

import type {
  StudioBindableEventOption,
  StudioBindablePropOption,
} from './bindingAuthoringContracts';

/***
 * Convert a component's bindable prop metadata record into labeled authoring options.
 * @utility @ankhorage/utility/collection
 */
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

/***
 * Convert a component's bindable event metadata record into labeled authoring options.
 * @utility @ankhorage/utility/collection
 */
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
