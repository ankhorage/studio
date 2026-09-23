# Binding authoring

Studio exposes one contextual binding surface at `/ankh/bindings/:nodeId`. It is opened from the selected component through the Studio AppBar and is intentionally separate from the Properties editor.

## Ownership

Studio owns authoring UX and manifest mutation only. Canonical binding shapes come from `@ankhorage/contracts`, bindable component props/events and event payload metadata come from ZORA, and binding execution remains in `@ankhorage/runtime`.

Studio does not maintain a second endpoint registry, event schema registry, or binding executor. Contracts `DataSchema` remains API/data-specific and is adapted into the same neutral Authoring Model used by other structure-driven Studio editors instead of defining a second generic form vocabulary.

## Property/data bindings

The editor exposes properties from the composed ZORA core/plugin metadata catalog injected by the application runtime. Authored bindings persist in `manifest.dataBindings` and support the canonical literal, state, context, and operation-result sources.

Operation-result bindings enumerate normalized `manifest.dataSources` uniformly, so external and generated APIs use the same authoring path. Response paths are derived from canonical operation response schemas and compared against ZORA bindable value metadata. Array responses expose their representative first item at path `0` and recursively expose paths below it, matching Runtime's numeric data-path behavior.

## Event/action bindings

The editor only exposes events declared by the injected composed ZORA binding metadata. Events can target canonical actions or canonical data-source operations.

Known event payload fields are surfaced from ZORA. Action payload fields come from Studio's existing action authoring metadata, while operation request inputs come from canonical operation request schemas. DataSchema-backed literal operation inputs are translated into the neutral Authoring Model and rendered through the shared ZORA Authoring Editor; event-payload mapping and action-target authoring remain binding-specific workflow behavior. Inputs can use literal values or event payload paths, including nested paths beneath object/record payload fields.

Primitive, finite choice, fixed-object and ordered-array DataSchema semantics stay explicit in the adapter. Schema compositions or dynamic record shapes that the current neutral engine cannot author produce diagnostics instead of falling back to arbitrary JSON text editing.

## Diagnostics

Studio resolves operation references against the same normalized operation catalog used by the authoring selectors. Missing operation references, response paths, required operation inputs, incompatible response/input values, unknown bindable props/events, and unavailable actions are surfaced as authoring diagnostics.

Unsupported DataSchema authoring semantics also surface through the neutral Authoring Model. Diagnostics never execute operations and do not reproduce Runtime execution logic. Runtime remains the only execution owner.
