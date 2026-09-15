import type { AppManifest } from '@ankhorage/contracts';

const LOCAL_SUPABASE_PORT_BASE = 54_321;
const LOCAL_SUPABASE_PORT_COUNT = 10_000;

/*** Complete missing project-specific local Supabase networking intent while preserving explicitly authored endpoints. */
export function initializeProjectLocalInfraNetworking(
  manifest: AppManifest,
  projectId: string,
): AppManifest {
  const { local } = manifest.infra.environments;
  if (!usesLocalSupabase(local) || local.networking?.publicBaseUrl) return manifest;

  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      environments: {
        ...manifest.infra.environments,
        local: {
          ...local,
          networking: {
            ...local.networking,
            publicBaseUrl: `http://127.0.0.1:${resolveLocalSupabasePort(projectId)}`,
          },
        },
      },
    },
  };
}

/*** Return whether the local Infra environment selects the shared Supabase platform for any provisioned capability. */
function usesLocalSupabase(local: AppManifest['infra']['environments']['local']): boolean {
  return (
    local.database?.provider === 'supabase' ||
    local.auth?.provider === 'supabase' ||
    local.objectStorage?.provider === 'supabase'
  );
}

/*** Derive a stable project-scoped local Supabase gateway port from the canonical project ID. */
function resolveLocalSupabasePort(projectId: string): number {
  const bucket = [...projectId].reduce(
    (hash, character) => (hash * 31 + (character.codePointAt(0) ?? 0)) % LOCAL_SUPABASE_PORT_COUNT,
    0,
  );
  return LOCAL_SUPABASE_PORT_BASE + bucket;
}
