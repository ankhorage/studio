import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'bun:test';

const scopeScriptPath = path.resolve('scripts/determine-studio-acceptance-scope.sh');

test('runs the complete acceptance suite for deletes, renames, Agent scripts, and unknown paths', async () => {
  await Promise.all([
    expectScopeForChange(
      'deleted documentation',
      async (root) => rm(path.join(root, 'docs', 'guide.md')),
      true,
    ),
    expectScopeForChange(
      'renamed documentation',
      async (root) => {
        await Bun.write(path.join(root, 'docs', 'renamed.md'), 'guide');
        await rm(path.join(root, 'docs', 'guide.md'));
      },
      true,
    ),
    expectScopeForChange(
      'Agent TypeScript script',
      (root) => writeFile(path.join(root, '.agents', 'skills', 'demo', 'scripts', 'audit.ts'), ''),
      true,
    ),
    expectScopeForChange(
      'unknown path',
      (root) => writeFile(path.join(root, 'config.yml'), ''),
      true,
    ),
  ]);
});

test('skips the complete acceptance suite only for explicit safe paths', async () => {
  await expectScopeForChange(
    'Agent guidance',
    (root) => writeFile(path.join(root, '.agents', 'skills', 'demo', 'SKILL.md'), '# Guidance'),
    false,
  );
});

async function expectScopeForChange(
  name: string,
  change: (root: string) => Promise<void>,
  expectedRequired: boolean,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-acceptance-scope-'));

  try {
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await mkdir(path.join(root, '.agents', 'skills', 'demo', 'scripts'), { recursive: true });
    await writeFile(path.join(root, 'docs', 'guide.md'), 'guide');
    await runGit(root, 'init');
    await runGit(root, 'config', 'user.email', 'studio-test@example.com');
    await runGit(root, 'config', 'user.name', 'Studio test');
    await runGit(root, 'add', '.');
    await runGit(root, 'commit', '--quiet', '-m', 'test: create scope fixture');
    const baseSha = await runGit(root, 'rev-parse', 'HEAD');

    await change(root);
    await runGit(root, 'add', '--all');
    await runGit(root, 'commit', '--quiet', '-m', 'test: change scope fixture');
    const headSha = await runGit(root, 'rev-parse', 'HEAD');
    const scope = await runScopeScript(root, baseSha, headSha);

    expect(scope, name).toContain(`required=${expectedRequired}`);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function runGit(root: string, ...arguments_: string[]): Promise<string> {
  const process = Bun.spawn({
    cmd: ['git', ...arguments_],
    cwd: root,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) throw new Error(`git ${arguments_.join(' ')} failed: ${stderr}`);
  return stdout.trim();
}

async function runScopeScript(root: string, baseSha: string, headSha: string): Promise<string> {
  const process = Bun.spawn({
    cmd: ['bash', scopeScriptPath, baseSha, headSha],
    cwd: root,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) throw new Error(`Acceptance scope script failed: ${stderr}`);
  return stdout;
}
