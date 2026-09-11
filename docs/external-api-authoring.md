# External API authoring

`/ankh/apis` connects existing services directly into the canonical manifest `infra.apis[]` registry. Studio does not own OpenAPI parsing, GraphQL introspection, REST normalization, or endpoint execution; those capabilities come from `@ankhorage/data-sources`.

## Progressive administration flow

The default authoring state asks only for a service or schema URL. Studio derives the canonical API id from the normalized host and path, ignoring scheme, query, and fragment, then runs automatic OpenAPI/GraphQL discovery. The URL stays available while discovery is running or after a failure.

Successful discovery persists exactly one canonical `infra.apis[]` definition. The connected-API catalog renders its discovered endpoints and operations as read-only rows with visible method/protocol labels and stable endpoint/operation ids. Operation execution remains on `/ankh/apis/operations` so connection and inspection are not mixed with runtime testing controls.

Advanced settings are disclosed only after selecting **Edit** on an existing external API. The generated id remains stable and read-only. Imported OpenAPI and GraphQL APIs expose their discovery strategy, source/schema URL, display metadata, and credential reference metadata; saving runs the existing discovery/upsert flow again under the same id so protocol, schemas, endpoints, and source location stay consistent. Manually authored REST APIs update their editable base URL and metadata in place while preserving authored operations.

Removal requires destructive confirmation and deletes only the selected external API from `infra.apis[]`. Studio refetches the manifest before reporting success and clears stale edit/fallback state for the removed API.

If automatic discovery fails, diagnostics remain visible and a focused manual REST fallback appears with the attempted URL and derived id. Manual authoring uses the same `@ankhorage/data-sources` owner workflow and persists the same canonical external REST API shape. **Retry discovery** returns to the URL-first state without clearing the attempted URL.

## Trusted host boundary

The browser submits only authoring intent and provider-neutral credential references. The local Studio host performs discovery and operation tests through a constrained HTTP transport with timeouts, response-size limits, redirect rejection, and cloud metadata target blocking. Trusted secret values are resolved only inside the host and are removed from browser-readable operation diagnostics.

## Persistence

Successful OpenAPI discovery, GraphQL introspection, and manual REST creation upsert an external API directly into `manifest.infra.apis`. External APIs use `origin: 'external'` and their actual `protocol: 'rest' | 'graphql'`; OpenAPI remains import metadata rather than another API kind. Reusing the same canonical id updates that entry. There is no secondary API catalog, data-source projection, dual-write state, or unsaved API model.

Discovered API edits reuse that same canonical upsert path. Manual REST settings and removals read the current manifest, target the exact canonical API id, persist a new manifest with the updated `infra.apis[]`, and require a manifest refetch before the UI reports success.

## Authoring flows

- **Auto discovery** probes direct and conventional OpenAPI document locations before trying GraphQL introspection at the supplied URL.
- **OpenAPI** uses only the canonical discovery/import flow.
- **GraphQL** executes the canonical introspection request and normalizes discovered operations.
- **Manual REST** is revealed only as a contextual fallback after automatic discovery fails.
- **Operation testing** uses the canonical data-source test runner on the dedicated operations route. Browser responses omit request headers and bodies and redact query values.

Package-neutral source-ID normalization and registry upsert helpers remain exported through `@ankhorage/studio/externalApiAuthoring`. URL-first id derivation and Studio-specific edit/remove orchestration are implementation details of the administration use case.

## Validation boundary

Changes to this flow must validate URL-derived ids, canonical upsert/edit/remove behavior, trusted host persistence, discovery failure diagnostics, progressive UI disclosure, endpoint method labels, destructive confirmation, and the dedicated operation-test route. External provider availability is injected or mocked in deterministic tests; real credentials never belong in repository or browser test fixtures.
