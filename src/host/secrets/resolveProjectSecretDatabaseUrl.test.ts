import { describe, expect, test } from 'bun:test';

import { resolveProjectSecretDatabaseUrl } from './resolveProjectSecretDatabaseUrl';

describe('resolveProjectSecretDatabaseUrl', () => {
  test('reads the trusted host database URL from the explicit process environment', () => {
    expect(
      resolveProjectSecretDatabaseUrl({
        processEnvironment: { ANKH_SECRET_STORE_DATABASE_URL: ' postgres://trusted/database ' },
      }),
    ).toBe('postgres://trusted/database');
  });

  test('rejects missing trusted host configuration without inspecting public Infra outputs', () => {
    expect(() => resolveProjectSecretDatabaseUrl({ processEnvironment: {} })).toThrow(
      'ANKH_SECRET_STORE_DATABASE_URL',
    );
  });
});
