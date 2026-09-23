# Studio testing strategy

Studio optimizes tests for **unique regression signal per runtime and maintenance cost**. Test count is not a quality target.

## Default suite

`bun run test` is the canonical fast suite. It excludes `*.e2e.test.ts` and `*.smoke.test.ts`. Raw `bun test` may discover those files, but every E2E and smoke suite must be opt-in and therefore report as skipped unless its explicit environment flag is enabled.

Fast tests must be deterministic. They must not perform package installation, launch browsers, depend on live external services, or start heavyweight subprocesses merely as incidental setup. Local filesystem work and focused in-process adapters are fine when they are part of the owning boundary.

## E2E, smoke, and acceptance

E2E and smoke suites validate a small number of cross-owner golden paths. They should not replay unit-level behavior matrices. Package installation, browser startup, Expo/native tooling, and real infrastructure belong here only when those effects are the contract under test.

For now these suites are explicit opt-in only. When the repository introduces a `develop` promotion branch, CI should enable E2E/smoke only for the `develop -> main` promotion path rather than for ordinary feature pull requests.

Run the named `test:e2e:*` and `test:smoke:*` package scripts when a focused manual validation is required; those scripts set the matching opt-in environment flags.

## Ownership rules

- Test observable behavior at the owner boundary.
- Keep one behavioral matrix per contract owner.
- Public-surface tests prove an export/facade boundary; they do not repeat the implementation suite.
- Source-text assertions are reserved for generated source or narrow architecture invariants that cannot be exercised more directly.
- A new test should add a regression signal that existing tests do not already provide.
- Prefer fakes or injected ports when a focused test would otherwise trigger unrelated installation, infrastructure, or network work.

## Review signals

Treat these as prompts for review, not automatic failures:

- long explicit timeouts in the fast suite;
- `spawn`, browser startup, polling, or many local servers in ordinary `*.test.ts` files;
- duplicated `*.public.test.ts` and implementation behavior;
- tests that read production TypeScript source merely to assert implementation spelling;
- broad fixtures that cross multiple owners when only one boundary is being asserted.

Measure runtime before setting performance budgets. Remove or merge tests only when unique regression coverage is preserved.
