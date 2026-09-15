import {
  createNodeInfraAdapterPackageResolver,
  type InfraAdapterPackageResolver,
} from '@ankhorage/infra';

/*** Resolve Studio-bundled Infra adapters through literal package imports while retaining generic installed-provider discovery. */
export function createStudioInfraAdapterPackageResolver(): InfraAdapterPackageResolver {
  const fallback = createNodeInfraAdapterPackageResolver();
  return {
    loadAsync(packageName) {
      switch (packageName) {
        case '@ankhorage/local':
          return import('@ankhorage/local');
        case '@ankhorage/minikube':
          return import('@ankhorage/minikube');
        case '@ankhorage/supabase':
          return import('@ankhorage/supabase');
        case '@ankhorage/supabase-vault':
          return import('@ankhorage/supabase-vault');
        default:
          return fallback.loadAsync(packageName);
      }
    },
  };
}
