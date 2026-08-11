# Studio administration shell

Generated apps mount Studio administration under `/ankh` during development. The route tree is a
first-class Expo Router section, not a set of route anchors backed by the normal app header.

Canonical routes:

- `/ankh`
- `/ankh/screens`
- `/ankh/screens/<screen-id>`
- `/ankh/apis`
- `/ankh/apis/data-sources`
- `/ankh/apis/operations`
- `/ankh/auth`
- `/ankh/auth/providers`
- `/ankh/auth/routes`
- `/ankh/auth/profile`
- `/ankh/secrets`
- `/ankh/theme`
- `/ankh/properties/<node-id>`

`@ankhorage/studio/studioAdminRouteModel` owns the canonical registry for route IDs, paths,
labels, icons, hierarchy, active matching, contextual availability, and contextual path
construction/decoding. `createStudioScreenRoutePath` and `resolveStudioScreenId` encode and decode
stable `ScreenSpec.id` values; the static `/ankh/screens` route is never treated as a detail route.
Generated pages and navigation consume this registry instead of assembling admin paths directly.

Screens administration at `/ankh/screens` consumes the package-neutral manifest screen/navigation
model. It represents unrouted and multiply referenced screens honestly, shows navigator
diagnostics, and sends create/delete, visibility, initial-route, sibling-order, and navigator-type
actions through `StudioProvider`'s canonical draft/autosave path. Hidden routes remain routable;
the overview never substitutes a second navigation model or a component-tree/Layers interface.

Screen detail at `/ankh/screens/<screen-id>` is a manifest-derived, refresh-safe projection keyed
only by `ScreenSpec.id`, independent of component selection. It shows canonical screen metadata and
every resolved route reference, including pathname/pattern, navigator parent, sibling order,
primary-navigation visibility, and initial-route state. Missing or deleted IDs render an explicit
state. Studio offers an app-screen action only for one concrete, parameter-free route reference;
unrouted, dynamic, and multiply referenced screens are reported honestly rather than choosing a
route. ADM 8 does not provide route-key or path renaming.

The normal app bar exposes one Administration action while Studio is active. Inside `/ankh`, the
admin shell provides a desktop sidebar and a compact drawer. `Back to app` returns to the latest
non-admin app location remembered by the current Studio session; navigation within `/ankh` does not
overwrite that location.

Auth and Secrets render as page content inside the admin shell. Auth configuration writes flow
through `StudioProvider` as the single canonical manifest writer, while OAuth credential payloads
remain server-owned in the project secret store. The pages keep provider health, trusted OAuth
credential linking, project-secret inventory, rotation, usage detection, guarded removal, and
browser-safe secret responses.

Theme administration is a single `/ankh/theme` page that edits the canonical active theme through
the existing manifest theme state for the currently active rendered theme mode. It does not
introduce mode-specific routes, mode switching UI, or a second theme model.

Properties is contextual. The selected node ID is encoded in `/ankh/properties/<node-id>`, decoded
through the route model, resolved across the Studio manifest, mapped to its owning screen, and then
used to activate that screen and select the requested node when necessary.
