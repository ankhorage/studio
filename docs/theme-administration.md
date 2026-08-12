# Theme administration

Studio Theme administration edits the canonical `ThemeConfig` stored in the project manifest. It does
not keep a second Studio theme, preview theme, recipe schema, or persisted editor mode.

## Ownership

The Theme authoring path follows the standalone package boundaries:

```text
@ankhorage/contracts
  canonical serializable ThemeConfig
  global token overrides
  generic persisted recipe values

@ankhorage/surface
  resolved runtime colors, spacing, radii, typography, and shadows

@ankhorage/zora
  component/pattern Theme recipe metadata
  recipe defaults and validation
  runtime recipe resolution

@ankhorage/studio
  routes and authoring UI
  canonical manifest mutations
```

Studio consumes released `@ankhorage/contracts@7.2.0`, `@ankhorage/surface@2.2.0` through ZORA,
and `@ankhorage/zora@2.12.0`. Recipe field definitions, defaults, options, kinds, and token-family
relationships are never copied into Studio.

## Routes

Global Theme administration is available at:

```text
/ankh/theme
/ankh/theme/colors
/ankh/theme/typography
/ankh/theme/spacing
/ankh/theme/radii
/ankh/theme/shadows
```

Recipe detail routes are derived from the live ZORA recipe registry:

```text
/ankh/theme/components/{recipeName}
/ankh/theme/patterns/{recipeName}
```

The Theme overview groups the published recipes by their ZORA-owned `kind`. Dynamic recipe detail
routes are not duplicated as fixed sidebar entries.

## Light and dark editing

Colors and harmony remain mode-specific source on `ThemeConfig.light` and `ThemeConfig.dark`.
The Theme editor Light/Dark selector calls the mounted ZORA/Surface `setMode` authority, so the app
and `/ankh` render the same actual runtime mode.

Switching the editor between Light and Dark does not persist `activeThemeMode`. Changing a project's
configured default mode is a separate concern from previewing or editing either source branch.

## Global tokens

Spacing, radii, typography, and shadows are theme-global authored overrides shared by both modes.
Studio shows the currently resolved Surface tokens and persists only values that the author changes.
Omitted values continue to inherit Surface defaults.

Numeric spacing, radii, typography-size, and shadow values reject negative and non-finite values.
The canonical `none` spacing and radius values remain inherited at zero. Free spacing, radius,
typography-size, and shadow token names may be added where the owner contracts permit them.
Canonical typography heading and weight slots remain constrained by the Surface owner contract.

Resetting an authored value removes that override instead of copying the current resolved default
into the manifest.

## Component and pattern recipes

Studio reads `ZORA_THEME_RECIPE_META` at the UI integration boundary. For every published recipe it
renders fields generically from the metadata field kind:

```text
choice  -> ZORA metadata options
boolean -> On / Off
 token  -> currently resolved keys from the declared runtime token family
```

Typography token fields use the same key space as ZORA runtime validation: typography sizes,
weights, and headings. Other token fields use the resolved runtime keys for their declared family.

Only selected override values are persisted under `ThemeConfig.recipes`. Choosing Inherited removes
the field override. Unknown persisted fields are preserved by Studio mutations and remain subject to
ZORA's owner policy at runtime; Studio does not guess or normalize unknown recipe metadata.

Theme changes never rewrite component instances. Explicit node properties remain owned by the
instance Properties workflow, and ZORA remains responsible for the tested runtime precedence between
recipe defaults, Theme overrides, and permitted explicit instance props.

## Fonts and modules

Google Fonts lifecycle and selection are still owned by the `expo-google-fonts` module. Its current
configuration exposes module-specific installed-font state and `activeFontId`; there is no generic
Theme-font capability contract that Studio can consume without coupling Theme administration to one
module implementation.

Therefore ADM-13 does not add `/ankh/theme/typography/fonts` or Google-Fonts-specific branches to
Theme administration. Font installation/configuration continues through Modules until an owning
package publishes a generic font capability suitable for Theme authoring. Surface continues to keep
module-derived font families separate from persisted Theme token source.
