# Studio Preview mode

Preview is a mode of the real generated application, not a second application representation. On
app routes, the Studio AppBar exposes a one-step Preview action; while active, the emphasized Edit
action returns to authoring mode.

Both modes render the current Studio manifest through the same generated route tree,
`RuntimeRenderer`, canonical ZORA component registry, app extensions, data sources, bindings, and
Runtime action executor:

```text
Edit
  interactionPolicy = passive
  Runtime disableActions = true
  selection, measurement, and canvas DnD = enabled

Preview
  interactionPolicy = enabled
  Runtime disableActions = false
  selection, measurement, contextual authoring UI, and canvas DnD = disabled
```

Interaction policy and Runtime action suppression remain separate because component-owned state and
manifest-owned actions have different execution paths. Third-party components receive
`interactionPolicy` only when their extension declares support explicitly.

Switching modes does not push or replace a route. Runtime navigation in Preview changes the
canonical Expo Router location, and returning to Edit retains the reached route. Administration
continues to use `/ankh/*` and the session's latest non-admin location; it is never rendered as the
app Preview surface.

The generated app registry and manifest navigator are the only production and Preview sources of
truth.
