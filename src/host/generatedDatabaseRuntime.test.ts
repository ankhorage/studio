import type { GeneratedApiDefinition } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import {
  type GeneratedDatabaseRuntimeManifest,
  resolveGeneratedDatabaseRuntime,
} from './generatedDatabaseRuntime';

function generatedApi(id: string, adapterId: string): GeneratedApiDefinition {
  return {
    id,
    protocol: 'rest',
    basePath: '/api',
    database: { id: adapterId, kind: 'database' },
    resources: [],
  };
}

test('selects unique generated adapter ids for the provisioned Supabase database', () => {
  const manifest = {
    infra: { database: { provider: 'supabase', tier: 'dev' }, modules: [] },
    generatedApis: {
      alpha: generatedApi('alpha', 'primary-db'),
      beta: generatedApi('beta', 'analytics-db'),
      gamma: generatedApi('gamma', 'primary-db'),
    },
  } satisfies GeneratedDatabaseRuntimeManifest;

  expect(resolveGeneratedDatabaseRuntime(manifest)).toEqual({
    provider: 'supabase',
    adapterIds: ['analytics-db', 'primary-db'],
  });
});

test('does not claim a runtime adapter for unsupported database providers', () => {
  const manifest = {
    infra: { database: { provider: 'postgres-other', tier: 'dev' }, modules: [] },
    generatedApis: { alpha: generatedApi('alpha', 'primary-db') },
  } satisfies GeneratedDatabaseRuntimeManifest;

  expect(resolveGeneratedDatabaseRuntime(manifest)).toBeNull();
});
