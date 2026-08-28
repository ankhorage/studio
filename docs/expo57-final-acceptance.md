# Expo 57 final released-package acceptance

Issue [studio#315](https://github.com/ankhorage/studio/issues/315) is the final Expo 57
roadmap gate. Its permanent all-template fixture lives in
`fixtures/expo57-all-templates`. The fixture is a standalone package and its copied
execution root is also its installation root. It declares a normal Registry range for
`@ankhorage/studio` and imports generation only through the published
`@ankhorage/studio/host` subpath.

The fixture never consumes a sibling checkout, repository source, a Bun workspace,
`file:`, `link:`, a global Expo CLI, or a network-resolved Expo fallback. Each generated
application is then treated as another standalone package/install root.

## Automated gates

Run the active-state audit independently:

```bash
bun run test:audit:expo57-zero-stale-state
```

The audit scans active package manifests, Studio application state, generator/scaffold
source, executable fixtures, scripts, and workflows. Every apparent obsolete artifact
must either fail or have an exact executable classification. Historical changelogs,
generated docs, and lockfile history are reported as non-active rather than incorrectly
treated as production state.

Run the complete template matrix:

```bash
bun run test:acceptance:expo57-all-templates
```

For each active template the Registry-installed Studio host must:

1. generate the app without a manual output edit;
2. produce only Registry dependency ranges;
3. create a lockfile and pass a cold frozen install in the app root;
4. pass the zero-stale-state assertion;
5. typecheck with the app-installed TypeScript executable;
6. pass `expo install --check` through the app-installed Expo CLI;
7. pass the app-installed Expo Doctor.

CI splits the catalog into four deterministic shards with
`ANKH_EXPO57_TEMPLATE_SHARD=N/4`. A local focused rerun can use the same environment
variable.

## Release and hardware boundary

This harness can be prepared and locally verified before `[expo 11]` closes. Final
roadmap acceptance is recorded only after studio#314 is done, PR #334 and the refreshed
PR #335 are merged, the resulting package versions are visible in the Registry, and the
same gates are rerun against that released graph.

The automated all-template gate complements rather than replaces Web/static/Infra,
clean CNG, Android development/release, iOS simulator/release, and physical-device
capability evidence. Camera preview and valid QR/EAN-13/EAN-8 optical scans remain
physical-device gates; unavailable hardware must be documented explicitly and never
represented by simulator or export evidence.

This keeps Studio aligned with a normal Ankhorage app: the published host generates the
same manifest-driven Runtime, ZORA, Expo Router, adapter, module, and platform contracts
that customer apps consume, while package owners remain responsible for their own fixes
and releases.
