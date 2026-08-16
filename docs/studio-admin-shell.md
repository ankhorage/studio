# Studio administration shell

Generated apps mount Studio administration under `/ankh` during development. The route tree is a
first-class Expo Router section, not a set of route anchors backed by the normal app header.

Canonical routes:

- `/ankh`
- `/ankh/screens`
- `/ankh/screens/<screen-id>`
- `/ankh/modules`
- `/ankh/modules/<module-id>`
- `/ankh/apis`
- `/ankh/apis/data-sources`
- `/ankh/apis/operations`
- `/ankh/auth`
- `/ankh/auth/providers`
- `/ankh/auth/routes`
- `/ankh/auth/profile`
- `/ankh/secrets`
- `/ankh/deploy`
- `/ankh/theme`
- `/ankh/properties/<node-id>`

`@ankhorage/studio/studioAdminRouteModel` owns the canonical registry for route IDs, paths,
labels, icons, hierarchy, active matching, contextual availability, and contextual path
construction/decoding. `createStudioScreenRoutePath` and `resolveStudioScreenId` encode and decode
stable `ScreenSpec.id` values; the static `/ankh/screens` route is never treated as a detail route.
The equivalent module helpers encode and decode stable Orchestrator module IDs without creating
module-specific top-level routes.
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
route. The canonical Studio manifest invariant requires each screen registry key to equal its
unique `ScreenSpec.id`; malformed mismatches or duplicate stable IDs are diagnosed and never used
to choose an arbitrary detail screen. ADM 8 does not provide route-key or path renaming.

The normal app bar exposes Administration and Preview actions while Studio is active on an app
route. Preview becomes an emphasized Edit action while active, and contextual Properties,
Bindings, Insert, Delete, parent-selection, and dialog affordances are withheld until Edit resumes.
Inside `/ankh`, the admin shell provides a desktop sidebar and a compact drawer; administration is
never presented as app Preview content. `Back to app` returns to the latest non-admin app location
remembered by the current Studio session, and navigation within `/ankh` does not overwrite that
location.

Auth and Secrets render as page content inside the admin shell. Auth configuration writes flow
through `StudioProvider` as the single canonical manifest writer, while OAuth credential payloads
remain server-owned in the project secret store. The pages keep provider health, trusted OAuth
credential linking, project-secret inventory, rotation, usage detection, guarded removal, and
browser-safe secret responses.

Deploy administration at `/ankh/deploy` consumes `@ankhorage/deploy` owner APIs for canonical
target configuration, store listing/locales/assets, monetization, prepared release state, release
history, readiness, planning, execution, resume, and lifecycle controls. Locale and semantic asset
mutations, the exact canonical product array, and `ProjectReleaseInput` are sent through Deploy's
released project authoring APIs; Studio never constructs Deploy filesystem paths or persists a second
deployment model. Saving authored desired state never mutates a provider.

Studio previews Deploy's exact inspection/plan objects, visibly marks irreversible plan steps,
requires explicit confirmation, and sends the same inspected snapshot to Deploy execution without
re-planning in the browser. Waiting, blocked, no-change, drifted, failed, completed, and
history-recording outcomes remain owner-defined states. Release execution/resume/lifecycle mutations
are guarded against concurrent double submission in both browser orchestration and the trusted host.
Immutable Deploy history exposes execution/time, desired/current/release revisions, executed and
attempted steps, result code, and verification state without alternate Studio persistence. Raw
credential material remains server-only, execution IDs are created by the trusted host, and browser
responses continue through the secret-shaped response guard.

Theme administration is a single `/ankh/theme` page that edits the canonical active theme through
the existing manifest theme state for the currently active rendered theme mode. It does not
introduce mode-specific routes, mode switching UI, or a second theme model.

Modules administration uses the standalone Orchestrator ledger as the canonical lifecycle and
configuration source. `/ankh/modules` lists registered and installed states and invokes install or
uninstall through the Orchestrator adapter. `/ankh/modules/<module-id>` hosts an optional
package-owned administration contribution. Contribution absence is a supported lifecycle-only
state, and an unknown ID renders explicitly instead of inventing a configuration form.
When a running generated app requires removal to be deferred, the page keeps the pending state
visible and offers explicit finalization after the app has been reloaded.

Studio owns only generic contribution registration, transport, routing, and hosting. Serializable
`config-schema` contributions remain a generic fallback. Modules may additionally expose an optional
package-owned React/ZORA administration view; Studio gives that view only an opaque
`execute(operation, input)` transport, caller-supplied component metadata, and a generic project
refresh callback. Operation names, payload validation, result semantics, domain state, and domain UI
remain owned by the module package. Rich views never create parallel top-level routes or bypass the
canonical module lifecycle/config boundary.

Standalone module packages own config normalization, generated paths/files, layout contribution,
cleanup behavior, and their optional administration implementation. Manifest `infra.modules` and
`infra.modulesConfig` are deterministic lifecycle projections, not a second writable Studio store.

Properties is contextual. The selected node ID is encoded in `/ankh/properties/<node-id>`, decoded
through the route model, resolved across the Studio manifest, mapped to its owning screen, and then
used to activate that screen and select the requested node when necessary.
