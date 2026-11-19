import {
  createNodeInfraAdapterPackageResolver,
  type InfraAdapterPackageResolver,
} from '@ankhorage/infra';
import type { SupabaseVaultSqlClient } from '@ankhorage/secrets-supabase-vault';

/*** Resolve Studio-bundled Infra adapters through literal package imports while retaining generic installed-provider discovery. */
export function createStudioInfraAdapterPackageResolver(
  options: { readonly supabaseVaultClient?: SupabaseVaultSqlClient } = {},
): InfraAdapterPackageResolver {
  const fallback = createNodeInfraAdapterPackageResolver();
  return {
    loadAsync(packageName) {
      switch (packageName) {
        case '@ankhorage/infra-local':
          return import('@ankhorage/infra-local');
        case '@ankhorage/infra-minikube':
          return import('@ankhorage/infra-minikube');
        case '@ankhorage/infra-supabase':
          return import('@ankhorage/infra-supabase');
        case '@ankhorage/secrets-supabase-vault':
          return loadSupabaseVaultModuleAsync(options.supabaseVaultClient);
        default:
          return fallback.loadAsync(packageName);
      }
    },
  };
}

/*** Bind Studio's trusted SQL boundary into the otherwise parameterless Infra adapter factory. */
async function loadSupabaseVaultModuleAsync(
  client: SupabaseVaultSqlClient | undefined,
): Promise<unknown> {
  const module = await import('@ankhorage/secrets-supabase-vault');
  return {
    infraAdapterDescriptor: module.infraAdapterDescriptor,
    createInfraAdapter: () => module.createInfraAdapter(client === undefined ? {} : { client }),
  };
}
