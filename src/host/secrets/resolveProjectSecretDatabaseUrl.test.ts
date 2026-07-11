import { afterEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { resolveProjectSecretDatabaseUrl } from './resolveProjectSecretDatabaseUrl';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function createProjectRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-studio-secret-url-'));
  temporaryRoots.push(root);
  return root;
}

describe('resolveProjectSecretDatabaseUrl', () => {
  test('prefers trusted Studio host configuration', async () => {
    const projectPath = await createProjectRoot();
    const result = await resolveProjectSecretDatabaseUrl({
      projectPath,
      processEnvironment: {
        ANKH_SECRET_STORE_DATABASE_URL: 'postgres://host-config',
        DATABASE_URL: 'postgres://generic',
      },
    });

    expect(result).toBe('postgres://host-config');
  });

  test('reads generated untracked project environment values', async () => {
    const projectPath = await createProjectRoot();
    const infraRoot = path.join(projectPath, 'infra', 'minikube');
    await fs.mkdir(infraRoot, { recursive: true });
    await fs.writeFile(
      path.join(infraRoot, '.env'),
      'SUPABASE_DB_URL="postgres://project-local"\nEXPO_PUBLIC_SUPABASE_URL=http://public\n',
      'utf8',
    );

    const result = await resolveProjectSecretDatabaseUrl({
      projectPath,
      processEnvironment: {},
    });

    expect(result).toBe('postgres://project-local');
  });

  test('does not invent a plaintext fallback', async () => {
    const projectPath = await createProjectRoot();
    let error: unknown;

    try {
      await resolveProjectSecretDatabaseUrl({ projectPath, processEnvironment: {} });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      'Supabase Vault database access is not configured',
    );
  });
});
