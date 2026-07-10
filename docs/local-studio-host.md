# Local Studio host

`@ankhorage/studio` owns the local development control plane under `src/host/`.

## Start

```bash
ankh studio dev
```

This starts the loopback-only HTTP host on `127.0.0.1:3000` and the first-party Expo Studio app. `ANKHORAGE_STUDIO_HOST_PORT` configures the standalone host script.

## Workspace

The host resolves the nearest package named `@ankhorage/studio` that contains an `apps/` directory. Generated projects live in `apps/<project-id>`; `apps/studio` is reserved for the first-party dashboard.

## Architecture

The dashboard uses the HTTP adapter. Studio CLI project commands call `ProjectManager` and `ModuleManager` directly. Both paths share the same project, manifest, module, infrastructure, launch, and workspace services.

The HTTP routes are transport adapters only. Project generation, manifest persistence, module changes, dependency installation, infrastructure operations, launch behavior, and process cleanup stay in shared `src/host` services.

The host binds to loopback by default, validates project IDs, rejects paths outside `apps/`, writes draft and project manifests atomically, bounds command output returned by HTTP, and terminates owned port-forward processes when the host closes.

## Public API

Host consumers import the supported service boundary from `@ankhorage/studio/host`. Internal layout, manifest-system, scaffolding, and process helpers remain private implementation details.

## Validation

```bash
bun run test:host-smoke
```

The smoke test creates a real app from the published template catalog, synchronizes it, edits its Studio manifest, verifies generated imports, checks infrastructure status, and deletes the project without using `ankhorage4`.

## Troubleshooting

- Port conflict: stop the process using port 3000 or set `ANKHORAGE_STUDIO_HOST_PORT` for the standalone host.
- Package installation failure: run `bun install` at the Studio repository root and inspect the command output.
- Dashboard connection failure: start both services with `ankh studio dev`.
