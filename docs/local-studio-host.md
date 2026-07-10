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

The host binds to loopback by default, validates project IDs, rejects paths outside `apps/`, writes draft and project manifests atomically, bounds command output returned by HTTP, and terminates owned port-forward processes when the host closes.

## Troubleshooting

- Port conflict: stop the process using port 3000 or set `ANKHORAGE_STUDIO_HOST_PORT` for the standalone host.
- Package installation failure: run `bun install` at the Studio repository root and inspect the command output.
- Dashboard connection failure: start both services with `ankh studio dev`.
