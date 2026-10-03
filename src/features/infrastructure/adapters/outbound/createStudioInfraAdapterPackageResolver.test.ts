import type {
  InfraExecutionContext,
  InfraLedger,
  InfraOwnedResource,
  InfraServiceAdapter,
} from '@ankhorage/contracts/infra';
import type {
  SupabaseVaultQueryResult,
  SupabaseVaultSqlClient,
  SupabaseVaultSqlExecutor,
} from '@ankhorage/supabase-vault';
import { expect, test } from 'bun:test';

import { createStudioInfraAdapterPackageResolver } from './createStudioInfraAdapterPackageResolver';

test('injects Studio trusted SQL access into the Supabase Vault Infra adapter', async () => {
  const owner = createOwner();
  const client = new RecordingVaultClient();
  const resolver = createStudioInfraAdapterPackageResolver({ supabaseVaultClient: client });
  const loaded = await resolver.loadAsync('@ankhorage/supabase-vault');
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
