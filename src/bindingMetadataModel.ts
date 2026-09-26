import type { UiComponentMetaRegistry, UiNode } from '@ankhorage/contracts';
import { mapRecordEntries } from '@ankhorage/utility/collection';

import type {
  StudioBindableEventOption,
  StudioBindablePropOption,
} from './bindingAuthoringContracts';

/***
 * Convert a component's bindable prop metadata record into labeled authoring options.
 */
export function resolveStudioBindableProps(
  node: UiNode,
  registry: UiComponentMetaRegistry,
): readonly StudioBindablePropOption[] {
  const props = registry[node.type]?.bindings?.props ?? {};

  return mapRecordEntries(props, ([name, meta]) => ({
    name,
    label: meta.label ?? name,
    meta,
  }));
}

/***
 * Convert a component's bindable event metadata record into labeled authoring options.
 */
export function resolveStudioBindableEvents(
  node: UiNode,
  registry: UiComponentMetaRegistry,
): readonly StudioBindableEventOption[] {
  const events = registry[node.type]?.bindings?.events ?? {};

  return mapRecordEntries(events, ([name, meta]) => ({
    name,
    label: meta.label ?? name,
    meta,
  }));
}
