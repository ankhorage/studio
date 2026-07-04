# Studio consolidated model helpers

This release groups several remaining package-neutral Studio helper models into standalone public subpaths.

## Runtime diagnostics

`@ankhorage/studio/runtimeDiagnosticsModel` owns formatting, equality checks, and notice-color resolution for runtime diagnostics.

## Admin route model

`@ankhorage/studio/studioAdminRouteModel` owns route parsing and render-state helpers for Studio admin routes.

## Selection model

`@ankhorage/studio/studioSelectionModel` owns the package-neutral selection adapter model. Hosts still bridge it to their concrete UI selection provider.

## Localization panel model

`@ankhorage/studio/localizationPanelModel` owns translatable-field collection, localization-key creation, filtering, and locale add/remove model helpers.

## Host-owned concerns

Hosts still own React state, rendering, Zora component metadata, runtime config composition, routing implementation, persistence, network fetches, and concrete UI components.
