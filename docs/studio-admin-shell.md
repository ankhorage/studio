# Studio administration shell

Generated apps mount Studio administration under `/ankh` during development. The route tree is a
first-class Expo Router section, not a set of route anchors backed by the normal app header.

Canonical routes:

- `/ankh`
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
labels, icons, hierarchy, active matching, contextual availability, and Properties path
construction/decoding. Generated pages and navigation should consume this registry instead of
assembling admin paths directly.

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
