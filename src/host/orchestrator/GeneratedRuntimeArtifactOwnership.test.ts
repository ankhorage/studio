import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { GeneratedRuntimeArtifactOwnership } from './GeneratedRuntimeArtifactOwnership';

const RUNTIME_EXECUTOR_PATH = 'src/generated/runtimeCapabilityExecutor.ts';
const projectPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    projectPaths
      .splice(0)
      .map((projectPath) => fs.rm(projectPath, { force: true, recursive: true })),
  );
});

describe('GeneratedRuntimeArtifactOwnership', () => {
  it('creates ownership for the generated Runtime executor without adding it to route ownership', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRuntimeArtifactOwnership();

    await ownership.initialize(projectPath, [RUNTIME_EXECUTOR_PATH]);

    expect(await readLedger(projectPath)).toMatchObject({ files: [RUNTIME_EXECUTOR_PATH] });
  });

  it('updates the Runtime executor ledger during reconciliation', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRuntimeArtifactOwnership();
    await ownership.initialize(projectPath, [RUNTIME_EXECUTOR_PATH]);
    await writeRuntimeExecutor(projectPath, 'first executor');

    await ownership.reconcile(projectPath, [RUNTIME_EXECUTOR_PATH]);

    expect(await fs.readFile(path.join(projectPath, RUNTIME_EXECUTOR_PATH), 'utf8')).toBe(
      'first executor',
    );
    expect(await readLedger(projectPath)).toMatchObject({ files: [RUNTIME_EXECUTOR_PATH] });
  });

  it('initializes ownership during reconciliation for an existing project without a Runtime ledger', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRuntimeArtifactOwnership();

    await ownership.reconcile(projectPath, [RUNTIME_EXECUTOR_PATH]);

    expect(await readLedger(projectPath)).toMatchObject({ files: [RUNTIME_EXECUTOR_PATH] });
  });

  it('cleans up only the stale Runtime executor and preserves independent generated files', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRuntimeArtifactOwnership();
    const independentPath = path.join(projectPath, 'src/generated/independent.ts');
    await ownership.initialize(projectPath, [RUNTIME_EXECUTOR_PATH]);
    await writeRuntimeExecutor(projectPath, 'stale executor');
    await fs.mkdir(path.dirname(independentPath), { recursive: true });
    await fs.writeFile(independentPath, 'independent generated source', 'utf8');

    await ownership.reconcile(projectPath, []);

    expect(await pathExists(path.join(projectPath, RUNTIME_EXECUTOR_PATH))).toBe(false);
    expect(await fs.readFile(independentPath, 'utf8')).toBe('independent generated source');
    expect(await readLedger(projectPath)).toMatchObject({ files: [] });
  });

  it('rejects arbitrary generated paths instead of widening Runtime artifact ownership', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRuntimeArtifactOwnership();

    return expect(ownership.initialize(projectPath, ['src/generated/unowned.ts'])).rejects.toThrow(
      'Path is outside current Runtime artifact ownership',
    );
  });
});

async function createProjectPath(): Promise<string> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-runtime-artifact-'));
  projectPaths.push(projectPath);
  return projectPath;
}

async function readLedger(projectPath: string): Promise<unknown> {
  return JSON.parse(
    await fs.readFile(path.join(projectPath, '.ankh/runtime-artifact-ledger.json'), 'utf8'),
  ) as unknown;
}

async function writeRuntimeExecutor(projectPath: string, content: string): Promise<void> {
  const executorPath = path.join(projectPath, RUNTIME_EXECUTOR_PATH);
  await fs.mkdir(path.dirname(executorPath), { recursive: true });
  await fs.writeFile(executorPath, content, 'utf8');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
