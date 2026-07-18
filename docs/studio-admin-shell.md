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

Auth and Secrets render as page content inside the admin shell. They keep the existing auth settings,
provider health, trusted OAuth credential flow, project-secret inventory, rotation, usage detection,
guarded removal, and browser-safe secret responses.

Theme administration is a single page that edits the active theme through the existing manifest
theme state. It does not introduce mode-specific routes or a second theme model.

Properties is contextual. The selected node ID is encoded in `/ankh/properties/<node-id>`, decoded
through the route model, and resolved against the active Studio tree.
