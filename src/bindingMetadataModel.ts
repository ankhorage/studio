import type { UiComponentBindingMeta, UiNode } from '@ankhorage/contracts';
import { mapRecordEntries } from '@ankhorage/utility/collection';

import type {
  StudioBindableEventOption,
  StudioBindablePropOption,
} from './bindingAuthoringContracts';

type BindableComponentMetaRegistry = Readonly<
  Record<string, { readonly bindings?: UiComponentBindingMeta }>
>;

/***
 * Convert a component's bindable prop metadata record into labeled authoring options.
 */
export function resolveStudioBindableProps(
  node: UiNode,
  registry: BindableComponentMetaRegistry,
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
  registry: BindableComponentMetaRegistry,
): readonly StudioBindableEventOption[] {
  const events = registry[node.type]?.bindings?.events ?? {};

  return mapRecordEntries(events, ([name, meta]) => ({
    name,
    label: meta.label ?? name,
    meta,
  }));
}
