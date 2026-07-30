import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import {
  bunLockfileReferencesPackageVersion,
  isPathInsideResolved,
  resolveInstalledPackageProvenance,
} from './installedPackageProvenance';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) => rm(temporaryRoot, { force: true, recursive: true })),
  );
});

async function createTemporaryRoot(): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'studio-package-provenance-'));
  temporaryRoots.push(temporaryRoot);
  return temporaryRoot;
}

describe('installed package provenance', () => {
  it('accepts a real installed package directory inside the resolved workspace', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const workspaceRoot = path.join(temporaryRoot, 'workspace');
    const packageRoot = path.join(workspaceRoot, 'node_modules', '@ankhorage', 'zora');
    await mkdir(packageRoot, { recursive: true });

    const provenance = await resolveInstalledPackageProvenance(workspaceRoot, packageRoot);

    expect(
      isPathInsideResolved(provenance.resolvedWorkspacePath, provenance.resolvedCandidatePath),
    ).toBe(true);
  });

  it('rejects a workspace symlink that resolves to a package outside the workspace', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const workspaceRoot = path.join(temporaryRoot, 'workspace');
    const externalPackageRoot = path.join(temporaryRoot, 'external', 'zora');
    const installedPackageRoot = path.join(workspaceRoot, 'node_modules', '@ankhorage', 'zora');
    await mkdir(path.dirname(installedPackageRoot), { recursive: true });
    await mkdir(externalPackageRoot, { recursive: true });
    await symlink(externalPackageRoot, installedPackageRoot);

    const provenance = await resolveInstalledPackageProvenance(workspaceRoot, installedPackageRoot);

    expect(
      isPathInsideResolved(provenance.resolvedWorkspacePath, provenance.resolvedCandidatePath),
    ).toBe(false);
  });

  it('rejects traversal and sibling paths that only share a string prefix', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const workspaceRoot = path.join(temporaryRoot, 'workspace');
    const siblingRoot = path.join(temporaryRoot, 'workspace-copy');
    await mkdir(workspaceRoot, { recursive: true });
    await mkdir(siblingRoot, { recursive: true });
    const [resolvedWorkspaceRoot, resolvedSiblingRoot] = await Promise.all([
      realpath(workspaceRoot),
      realpath(path.join(workspaceRoot, '..', 'workspace-copy')),
    ]);

    expect(isPathInsideResolved(resolvedWorkspaceRoot, resolvedSiblingRoot)).toBe(false);
    expect(resolvedSiblingRoot.startsWith(resolvedWorkspaceRoot)).toBe(true);
  });

  it('matches the exact installed package version in the generated lockfile', async () => {
    const temporaryRoot = await createTemporaryRoot();
    const lockfilePath = path.join(temporaryRoot, 'bun.lock');
    const lockfile = '"@ankhorage/zora": ["@ankhorage/zora@2.9.1", "", {}, "sha512-test"]\n';
    await writeFile(lockfilePath, lockfile);

    expect(bunLockfileReferencesPackageVersion(lockfile, '@ankhorage/zora', '2.9.1')).toBe(true);
    expect(bunLockfileReferencesPackageVersion(lockfile, '@ankhorage/zora', '2.9.0')).toBe(false);
  });
});
