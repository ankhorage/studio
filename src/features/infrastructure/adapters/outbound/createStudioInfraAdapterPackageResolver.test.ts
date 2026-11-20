import type {
  InfraExecutionContext,
  InfraLedger,
  InfraOwnedResource,
  InfraServiceAdapter,
} from '@ankhorage/contracts/infra';
import { resolveInfraAdaptersAsync } from '@ankhorage/infra';
import type {
  SupabaseVaultQueryResult,
  SupabaseVaultSqlClient,
  SupabaseVaultSqlExecutor,
} from '@ankhorage/secrets-supabase-vault';
import { expect, test } from 'bun:test';

import { createStudioInfraAdapterPackageResolver } from './createStudioInfraAdapterPackageResolver';

const canonicalInfraPackages = [
  '@ankhorage/infra-local',
  '@ankhorage/infra-minikube',
  '@ankhorage/infra-supabase',
] as const;

test('loads the canonical default Infra adapters with their public descriptor and factory', async () => {
  const resolver = createStudioInfraAdapterPackageResolver();
  const loaded = await Promise.all(
    canonicalInfraPackages.map((packageName) => resolver.loadAsync(packageName)),
  );

  for (const module of loaded) {
    expect(isRecord(module)).toBe(true);
    if (!isRecord(module)) throw new Error('Expected an Infra adapter package module.');
    expect(Reflect.get(module, 'infraAdapterDescriptor')).toBeDefined();
    expect(typeof Reflect.get(module, 'createInfraAdapter')).toBe('function');
  }

  const resolved = await resolveInfraAdaptersAsync(createDefaultEnvironment(), resolver);
  expect(resolved.ok).toBe(true);
  if (!resolved.ok) throw new Error('Expected Studio to resolve the default Infra adapters.');
  expect(resolved.value.compute.descriptor.package).toBe('@ankhorage/infra-local');
  expect(resolved.value.runtime.descriptor.package).toBe('@ankhorage/infra-minikube');
  expect(resolved.value.services.map(({ descriptor }) => descriptor.package)).toContain(
    '@ankhorage/infra-supabase',
  );
});

test('injects Studio trusted SQL access into the Supabase Vault Infra adapter', async () => {
  const owner = createOwner();
  const client = new RecordingVaultClient();
  const resolver = createStudioInfraAdapterPackageResolver({ supabaseVaultClient: client });
  const loaded = await resolver.loadAsync('@ankhorage/secrets-supabase-vault');
  if (!isRecord(loaded)) throw new Error('Expected a Supabase Vault Infra module.');
  const createInfraAdapter = Reflect.get(loaded, 'createInfraAdapter');
  if (typeof createInfraAdapter !== 'function') {
    throw new Error('Expected the Supabase Vault Infra factory.');
  }
  const adapter: unknown = Reflect.apply(createInfraAdapter, loaded, []);
  if (!isDestroyAdapter(adapter)) throw new Error('Expected a Supabase Vault destroy adapter.');

  const result = await adapter.destroyAsync(
    createContext(createLedger([owner])),
    createDestroyRequest(owner),
  );

  expect(result.ok).toBe(true);
  expect(client.statements.map((statement) => statement.trim().split('\n')[0])).toEqual([
    'delete from vault.secrets',
    'delete from ankh_secret_store.secret_metadata',
  ]);
});

class RecordingVaultClient implements SupabaseVaultSqlClient {
  readonly statements: string[] = [];

  query<TRow extends Record<string, unknown>>(
    statement: string,
    _parameters: readonly unknown[] = [],
  ): Promise<SupabaseVaultQueryResult<TRow>> {
    this.statements.push(statement);
    return Promise.resolve({ rows: [] });
  }

  transaction<TResult>(
    operation: (executor: SupabaseVaultSqlExecutor) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

function createOwner(): InfraOwnedResource {
  return {
    identity: {
      projectId: 'demo',
      environment: 'local',
      adapter: 'supabase-vault',
      resourceId: 'namespace',
    },
    externalId: 'ankh_secret_store:demo:local',
    persistent: true,
    retention: 'retain',
    dependsOn: [
      {
        projectId: 'demo',
        environment: 'local',
        adapter: 'supabase',
        resourceId: 'platform',
      },
    ],
  };
}

function createLedger(resources: readonly InfraOwnedResource[]): InfraLedger {
  return {
    schemaVersion: 1,
    projectId: 'demo',
    environment: 'local',
    targets: [],
    resources,
    outputs: [],
    artifacts: [],
  };
}

function createContext(previous: InfraLedger): InfraExecutionContext {
  return {
    projectId: 'demo',
    environment: 'local',
    desired: {
      deployment: {
        compute: { provider: 'local' },
        runtime: { provider: 'minikube' },
      },
      database: { provider: 'supabase', tier: 'dev' },
      secretStore: { provider: 'supabase-vault' },
    },
    previous,
    credentials: {
      findAsync: () => Promise.resolve({ ok: true, value: null, diagnostics: [] }),
      resolveAsync: () =>
        Promise.resolve({ ok: true, value: { token: 'secret-value' }, diagnostics: [] }),
      persistAsync: () => Promise.resolve({ ok: true, value: null, diagnostics: [] }),
    },
    secrets: {
      resolveAsync: () => Promise.resolve({ ok: true, value: 'secret-value', diagnostics: [] }),
    },
  };
}

function createDefaultEnvironment() {
  return {
    deployment: {
      compute: { provider: 'local' as const },
      runtime: { provider: 'minikube' as const },
    },
    database: { provider: 'supabase' as const, tier: 'dev' as const },
  };
}

function createDestroyRequest(owner: InfraOwnedResource) {
  return {
    projectId: 'demo',
    environment: 'local' as const,
    confirmation: { projectId: 'demo', environment: 'local' as const },
    persistence: { policy: 'delete' as const, confirmedResources: [owner.identity] },
  };
}

function isDestroyAdapter(value: unknown): value is Pick<InfraServiceAdapter, 'destroyAsync'> {
  return isRecord(value) && typeof Reflect.get(value, 'destroyAsync') === 'function';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
