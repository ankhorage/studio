from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    if old not in source:
        raise SystemExit(f"missing replacement in {path}: {old[:140]!r}")
    target.write_text(source.replace(old, new))


# Preserve the InfraEnvironmentSpec type across dynamic environment lookup.
replace(
    'src/authSettings.ts',
    'readOwnProperty(manifest.infra.environments, environment)?.auth',
    'readOwnProperty<InfraEnvironmentSpec>(manifest.infra.environments, environment)?.auth',
)
replace(
    'src/authSettings.ts',
    'readOwnProperty(manifest.infra.environments, environment);',
    'readOwnProperty<InfraEnvironmentSpec>(manifest.infra.environments, environment);',
)

replace(
    'src/projectAuthHealth.ts',
    "import type { AppEnvironmentId } from '@ankhorage/contracts/environments';",
    "import type { AppEnvironmentId } from '@ankhorage/contracts/environments';\nimport type { InfraEnvironmentSpec } from '@ankhorage/contracts/infra';",
)
replace(
    'src/projectAuthHealth.ts',
    'readOwnProperty(input.manifest.infra.environments, environment)?.auth',
    'readOwnProperty<InfraEnvironmentSpec>(input.manifest.infra.environments, environment)?.auth',
)

replace(
    'src/host/auth/projectAuthHealthService.ts',
    "import { readOwnProperty } from '@ankhorage/utility/object';",
    "import type { InfraEnvironmentSpec } from '@ankhorage/contracts/infra';\nimport { readOwnProperty } from '@ankhorage/utility/object';",
)
replace(
    'src/host/auth/projectAuthHealthService.ts',
    'readOwnProperty(manifest.infra.environments, environment);',
    'readOwnProperty<InfraEnvironmentSpec>(manifest.infra.environments, environment);',
)

# Studio is the composition root for the provider packages bundled with its default local workflow.
resolver = Path(
    'src/features/infrastructure/adapters/outbound/createStudioInfraAdapterPackageResolver.ts'
)
resolver.parent.mkdir(parents=True, exist_ok=True)
resolver.write_text("""import {
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
""")

replace(
    'src/features/infrastructure/composition/createStudioProjectInfraLifecycle.ts',
    "import type {\n  InfraDestroyResult,\n  InfraDownResult,\n  InfraGenerateResult,\n  InfraOutputsResult,\n  InfraUpResult,\n} from '@ankhorage/infra';",
    "import {\n  createEnvironmentInfraCredentialPort,\n  createEnvironmentInfraSecretPort,\n  type InfraDestroyResult,\n  type InfraDownResult,\n  type InfraGenerateResult,\n  type InfraOutputsResult,\n  type InfraUpResult,\n} from '@ankhorage/infra';",
)
replace(
    'src/features/infrastructure/composition/createStudioProjectInfraLifecycle.ts',
    "import {\n  createProjectInfraLifecycle,\n  type ProjectInfraLifecycle,\n  readStoredInfraStateAsync,\n} from '@ankhorage/infra/project';",
    "import {\n  createProjectInfraLifecycle,\n  type ProjectInfraLifecycle,\n  readStoredInfraStateAsync,\n} from '@ankhorage/infra/project';\n\nimport { createStudioInfraAdapterPackageResolver } from '../adapters/outbound/createStudioInfraAdapterPackageResolver';",
)
replace(
    'src/features/infrastructure/composition/createStudioProjectInfraLifecycle.ts',
    '  lifecycle: ProjectInfraLifecycle = createProjectInfraLifecycle(),',
    '  lifecycle: ProjectInfraLifecycle = createDefaultStudioProjectInfraLifecycle(),',
)
insert_marker = '/*** Convert a Studio project request into Infra\'s explicit environment lifecycle request. */'
replace(
    'src/features/infrastructure/composition/createStudioProjectInfraLifecycle.ts',
    insert_marker,
    "/*** Compose Infra's project lifecycle with Studio's bundled adapter packages and canonical environment credential ports. */\nfunction createDefaultStudioProjectInfraLifecycle(): ProjectInfraLifecycle {\n  return createProjectInfraLifecycle({\n    services: {\n      createDependencies: (context) => ({\n        adapterResolver: createStudioInfraAdapterPackageResolver(),\n        credentials: createEnvironmentInfraCredentialPort(context.env),\n        secrets: createEnvironmentInfraSecretPort(context.env),\n      }),\n    },\n  });\n}\n\n" + insert_marker,
)

# Current Contracts are readonly; build fixture variants immutably and remove obsolete networking fields.
replace(
    'src/host/layout/layoutGenerator.test.ts',
    "    const firstManifest = createOAuthManifest();\n    const secondManifest = createOAuthManifest();\n    secondManifest.infra.environments.local.networking = {\n      domain: 'local.example.test',\n      cdn: false,\n    };",
    "    const firstManifest = createOAuthManifest();\n    const secondBase = createOAuthManifest();\n    const secondManifest: AppManifest = {\n      ...secondBase,\n      infra: {\n        ...secondBase.infra,\n        environments: {\n          ...secondBase.infra.environments,\n          local: {\n            ...secondBase.infra.environments.local,\n            networking: { domain: 'local.example.test' },\n          },\n        },\n      },\n    };",
)
replace(
    'src/host/layout/layoutGenerator.test.ts',
    "    const manifest = createOAuthManifest();\n    manifest.metadata.slug = 'scanner';\n    manifest.infra.environments.local.networking = { domain: 'local.example.test', cdn: false };",
    "    const base = createOAuthManifest();\n    const manifest: AppManifest = {\n      ...base,\n      metadata: { ...base.metadata, slug: 'scanner' },\n      infra: {\n        ...base.infra,\n        environments: {\n          ...base.infra.environments,\n          local: {\n            ...base.infra.environments.local,\n            networking: { domain: 'local.example.test' },\n          },\n        },\n      },\n    };",
)

# Splash sizing/mode belongs to the current splash contract, which no longer contains resizeMode.
creation_assets = Path('src/host/orchestrator/projectCreationAssets.test.ts')
creation_assets.write_text(creation_assets.read_text().replace("      resizeMode: 'contain',\n", '').replace("        resizeMode: 'contain',\n", ''))

# StudioInfraUp exposes the canonical runtime provider, not the removed target field.
replace(
    'src/host/smoke/prepareAuth5NativeOAuthSmokeInfra.ts',
    "    if (!result.target) throw new Error('Infra Up completed without a deployment target.');\n    return { target: result.target };",
    "    return { target: result.runtime };",
)

# Prefer immutable destructuring in fixtures and remove accidental imports introduced by diagnostics repair.
replace(
    'src/authSettings.test.ts',
    '    const auth = manifest.infra.environments.local.auth;',
    '    const { auth } = manifest.infra.environments.local;',
)
replace(
    'src/host/layout/authRootBootstrap.test.ts',
    '  const auth = base.infra.environments.local.auth;',
    '  const { auth } = base.infra.environments.local;',
)
for path in (
    'src/host/orchestrator/projectManagerDeletion.test.ts',
    'src/host/orchestrator/studioInfraUp.test.ts',
):
    target = Path(path)
    target.write_text(target.read_text().replace(', AuthOAuthProviderConfig', ''))

# StudioHost.close is synchronous after the Infra runtime-handle cleanup.
cli = Path('src/cli/index.ts')
cli.write_text(cli.read_text().replace('    await studioHost.close();', '    studioHost.close();'))

# Keep the host smoke import group canonical after adding the Infra lifecycle test port.
host_smoke = Path('src/host/hostLifecycle.smoke.test.ts')
host_smoke.write_text(
    host_smoke.read_text().replace(
        "import type { StudioProjectInfraLifecycle } from '../features/infrastructure/composition/createStudioProjectInfraLifecycle';\n\nimport { ModuleManager }",
        "import type { StudioProjectInfraLifecycle } from '../features/infrastructure/composition/createStudioProjectInfraLifecycle';\nimport { ModuleManager }",
    )
)
