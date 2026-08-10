import type { AppManifest } from '@ankhorage/contracts';

export type GeneratedDatabaseRuntimeManifest = Pick<AppManifest, 'generatedApis' | 'infra'>;
export type GeneratedDatabaseRuntimeProvider = 'supabase';

export interface GeneratedDatabaseRuntimeSelection {
  readonly provider: GeneratedDatabaseRuntimeProvider;
  readonly adapterIds: readonly string[];
}

export function resolveGeneratedDatabaseRuntime(
  manifest: GeneratedDatabaseRuntimeManifest,
): GeneratedDatabaseRuntimeSelection | null {
  const adapterIds = [
    ...new Set(
      Object.values(manifest.generatedApis ?? {})
        .map((definition) => definition.database.id.trim())
        .filter(Boolean),
    ),
  ].sort();

  if (adapterIds.length === 0 || manifest.infra.database?.provider !== 'supabase') {
    return null;
  }

  return { provider: 'supabase', adapterIds };
}
