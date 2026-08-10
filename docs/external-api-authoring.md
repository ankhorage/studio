# External API authoring

`/ankh/apis` connects existing services into the canonical manifest `dataSources` registry. Studio does not own OpenAPI parsing, GraphQL introspection, REST normalization, or endpoint execution; those capabilities come from `@ankhorage/data-sources`.

## Trusted host boundary

The browser submits only authoring intent and provider-neutral credential references. The local Studio host performs discovery and operation tests through a constrained HTTP transport with timeouts, response-size limits, redirect rejection, and cloud metadata target blocking. Trusted secret values are resolved only inside the host and are removed from browser-readable operation diagnostics.

## Persistence

Successful OpenAPI discovery, GraphQL introspection, and manual REST creation upsert an external API source directly into the editable Studio manifest. External sources use `kind: 'api'`, `origin: 'external'`, and their actual `protocol: 'rest' | 'graphql'`; OpenAPI remains import metadata rather than a source kind. Reusing a normalized source ID updates that source. There is no secondary API catalog or unsaved API model.

## Authoring flows

- **Auto discovery** probes direct and conventional OpenAPI document locations before trying GraphQL introspection at the supplied URL.
- **OpenAPI** uses only the canonical discovery/import flow.
- **GraphQL** executes the canonical introspection request and normalizes discovered operations.
- **Manual REST** provides an explicit fallback when no schema document exists.
- **Operation testing** uses the canonical data-source test runner. Browser responses omit request headers and bodies and redact query values.

Package-neutral source-ID normalization and registry upsert helpers are exported through `@ankhorage/studio/externalApiAuthoring`.

## Validation boundary

Changes to this flow must validate the package model and trusted host behavior, the Studio web workspace, the generated app web administration surface, and the published package contents. External provider availability is injected or mocked in deterministic tests; real credentials never belong in repository or browser test fixtures.
