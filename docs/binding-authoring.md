# Binding authoring

Studio exposes one contextual binding surface at `/ankh/bindings/:nodeId`. It is opened from the selected component through the Studio AppBar and is intentionally separate from the Properties editor.

## Ownership

Studio owns authoring UX and manifest mutation only. Canonical binding shapes come from `@ankhorage/contracts`, bindable component props/events and event payload metadata come from ZORA, and binding execution remains in `@ankhorage/runtime`.

Studio does not maintain a second endpoint registry, event schema registry, or binding executor.

## Property/data bindings

The editor only exposes properties declared in `ZORA_BINDABLE_COMPONENT_META`. Authored bindings persist in `manifest.dataBindings` and support the canonical literal, state, context, and operation-result sources.

Operation-result bindings enumerate normalized `manifest.dataSources` uniformly, so external and generated APIs use the same authoring path. Response paths are derived from canonical operation response schemas and compared against ZORA bindable value metadata.

## Event/action bindings

The editor only exposes events declared by ZORA binding metadata. Events can target canonical actions or canonical data-source operations.

Known event payload fields are surfaced from ZORA. Action payload fields come from Studio's existing action authoring metadata, while operation request inputs come from canonical operation request schemas. Inputs can use literal values or event payload paths, including nested paths beneath object/record payload fields.

## Diagnostics

Studio reuses Runtime operation-reference validation for missing data sources, endpoints, and operations. Studio adds authoring diagnostics for missing response paths, incompatible response values, missing required operation inputs, unknown bindable props/events, and unavailable actions.

Diagnostics never execute operations. Runtime remains the only execution owner.
