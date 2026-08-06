# Metadata-driven instance Properties

`/ankh/properties/{nodeId}` is the canonical per-node authoring surface.

The page consumes the released ZORA component metadata registry at the concrete app/UI composition
boundary. Package-neutral Studio helpers receive a structural metadata registry from their caller
and never import or recreate concrete ZORA metadata.

Only props classified with:

```ts
{
  authoring: {
    authority: 'instance';
  }
}
```

become fields. Theme-owned props and props without authoring metadata are intentionally absent.

The initial editor set supports strings, numbers, booleans, and declared enum choices. Unsupported
future authoring types remain explicit rather than falling back to arbitrary JSON or string editors.

Node identity such as the node ID, component type, and optional alias remains read-only context. It
is not treated as component prop metadata.

Property changes update the selected node through the existing canonical manifest mutation and
persistence flow. Studio does not create a second unsaved Properties model.

This narrows the architectural gap between `apps/studio` and generated Ankhorage apps: both consume
the same manifest nodes and package-owned component metadata, while Studio adds only the authoring
interaction.
