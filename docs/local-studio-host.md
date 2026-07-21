# Local Studio host

`@ankhorage/studio` owns the local development control plane under `src/host/`.

## Start

```bash
ankh studio dev
```

This starts the loopback-only HTTP host on `127.0.0.1:3000` and the first-party Expo Studio app. `ANKHORAGE_STUDIO_HOST_PORT` configures the standalone host script.

## Workspace

The host resolves the nearest package named `@ankhorage/studio` that contains an `apps/` directory. Generated projects live in `apps/<project-id>`; `apps/studio` is reserved for the first-party Studio workspace app.

Project IDs are derived from project names with the shared Studio project identity model. For example, `Release Monitor` derives to `release-monitor` and `Infra Health` derives to `infra-health`. The ID `studio` is reserved, and names that derive to `studio` are rejected before any filesystem mutation.

The Studio workspace app owns project lifecycle management: listing projects, creating projects, opening a selected project detail screen, synchronizing generated project files, starting generated infrastructure, opening the infrastructure-hosted running app, deleting projects after confirmation, and installing workspace packages.

Generated apps own their own `/ankh` administration workspace. The workspace Studio app does not route a selected generated project's `/ankh` pages as local Studio routes.

## Architecture

The Studio app uses normal Expo Router stack routes:

```text
/
/projects/[projectId]
/create
/create/[category]
/create/[category]/[templateId]
```

The dashboard uses the HTTP adapter. Studio CLI project commands call `ProjectManager` and `ModuleManager` directly. Both paths share the same project, manifest, module, infrastructure, launch, and workspace services.

The HTTP routes are transport adapters only. Project generation, manifest persistence, module changes, dependency installation, infrastructure operations, launch behavior, and process cleanup stay in shared `src/host` services.

The host binds to loopback by default, validates project IDs, rejects paths outside `apps/`, writes draft and project manifests atomically, and bounds command output returned by HTTP.

For local Infra, Studio consumes `@ankhorage/infra` 1.0.0 generated app-owned Minikube projects. Each app slug maps to its own Minikube profile, generated Infra owns the `app`, `supabase`, and provider namespaces, and generated Infra owns `kubectl port-forward` process lifecycle through `infra/minikube/scripts/port-forward.sh`. Studio orchestrates generated lifecycle scripts and, on shutdown, asks registered projects' generated `port-forward.sh stop all` scripts to stop forwards; it does not run host Supabase or terminate arbitrary forward PIDs itself.

Workspace lifecycle labels are explicit:

- `Sync` promotes the Studio draft manifest where applicable, synchronizes the scaffold, regenerates generated routes/files, and synchronizes infrastructure artifacts. It does not start infrastructure.
- `Infrastructure Up` regenerates infrastructure artifacts as required, resolves trusted environment/secrets, executes the generated infrastructure `up` lifecycle, and registers port-forward ownership.
- `Open running app` starts or reuses the generated infrastructure app port-forward and opens the returned URL. It is not local Expo, web, iOS, or Android source startup.
- `Install workspace packages` runs the workspace-root install operation because the repository declares `apps/*` workspaces. It is application-level Studio UI, not a per-project action.

Project summaries are read from canonical manifests. `metadata.category` uses the shared `AppCategory` type, and the active visual identity resolves from `activeThemeId` and `themes`. The template catalog endpoint returns grouped category data from the canonical template package and does not expose template versions.

For OAuth-enabled projects, Studio pre-resolves trusted credentials into the `up.sh` child process environment when the local secret store is reachable. If the local secret store is unavailable because generated Infra is stopped, Studio runs `up.sh` without those ephemeral values and lets generated Infra restart Postgres, bootstrap Vault, resolve `credentialsRef` entries, and validate runtime OAuth before rollout.

## Public API

Host consumers import the supported service boundary from `@ankhorage/studio/host`. Internal layout, manifest-system, scaffolding, and process helpers remain private implementation details.

## Validation

```bash
bun run test:host-smoke
```

The smoke test creates a real app from the published template catalog, synchronizes it, edits its Studio manifest, verifies generated imports, checks infrastructure status, and deletes the project without using `ankhorage4`.

Changes that affect local Infra orchestration must also pass the opt-in Docker/Minikube gate:

```bash
bun run test:e2e
```

That gated test exercises Studio orchestration against generated Infra without adding Docker or Minikube requirements to normal `bun test`.

## Troubleshooting

- Port conflict: stop the process using port 3000 or set `ANKHORAGE_STUDIO_HOST_PORT` for the standalone host.
- Package installation failure: run `bun install` at the Studio repository root and inspect the command output.
- Dashboard connection failure: start both services with `ankh studio dev`.
