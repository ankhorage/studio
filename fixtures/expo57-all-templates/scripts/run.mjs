import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { getTemplateCatalog, ProjectManager } from '@ankhorage/studio/host';

import { assertNoStaleExpo57StateAsync } from './assertNoStaleExpo57StateAsync.mjs';

const commandTimeoutMs = 600_000;
const fixtureRoot = await realpath(process.cwd());
const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-all-templates-'));
const cacheRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-all-templates-cache-'));
const shard = parseShard(process.env.ANKH_EXPO57_TEMPLATE_SHARD ?? '1/1');
const keepOutput = process.argv.includes('--keep');

try {
  const studioVersion = await assertRegistryInstalledStudioAsync(fixtureRoot);
  const templates = getTemplateCatalog().categories.flatMap((category) =>
    category.templates.map((template) => ({ category: category.id, template })),
  );
  const selectedTemplates = templates.filter(
    (_entry, index) => index % shard.total === shard.index,
  );
  if (selectedTemplates.length === 0) {
    throw new Error(`Template shard ${shard.index + 1}/${shard.total} selected no templates.`);
  }

  console.log(
    `Validating ${selectedTemplates.length}/${templates.length} templates with @ankhorage/studio@${studioVersion} (shard ${shard.index + 1}/${shard.total}).`,
  );
  const manager = new ProjectManager(workspaceRoot);
  const evidence = [];
  for (const [selectionIndex, selection] of selectedTemplates.entries()) {
    const catalogIndex = templates.findIndex(
      (entry) =>
        entry.category === selection.category && entry.template.id === selection.template.id,
    );
    const displayName = `Expo57 Template ${catalogIndex + 1}`;
    const startedAt = Date.now();
    const created = await manager.createProject(
      displayName,
      { category: selection.category, templateId: selection.template.templateId },
      undefined,
      { includeStudio: false },
    );
    await assertGeneratedTemplateAsync({
      cacheRoot: path.join(cacheRoot, `template-${catalogIndex + 1}`),
      projectRoot: created.path,
    });
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    evidence.push({
      checks: [
        'generate',
        'registry-lock',
        'frozen-install',
        'zero-stale',
        'typecheck',
        'expo-check',
        'expo-doctor',
      ],
      durationSeconds,
      projectId: created.id,
      template: selection.template.id,
    });
    console.log(
      `[${selectionIndex + 1}/${selectedTemplates.length}] ${selection.template.id} passed in ${durationSeconds}s.`,
    );
  }

  console.log(
    JSON.stringify(
      { shard: `${shard.index + 1}/${shard.total}`, studioVersion, evidence },
      null,
      2,
    ),
  );
} finally {
  await rm(cacheRoot, { force: true, recursive: true });
  if (keepOutput) console.log(`Retained generated template workspace: ${workspaceRoot}`);
  else await rm(workspaceRoot, { force: true, recursive: true });
}

async function assertGeneratedTemplateAsync({ cacheRoot, projectRoot }) {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  if (packageJson.workspaces !== undefined) {
    throw new Error(`${projectRoot} is not a standalone package root.`);
  }
  if (packageJson.engines?.node !== '24.x') {
    throw new Error(`${projectRoot} does not target Node 24.x.`);
  }
  const appConfig = await readFile(path.join(projectRoot, 'app.config.ts'), 'utf8');
  if (!appConfig.includes('reactCompiler: true')) {
    throw new Error(`${projectRoot} does not enable React Compiler.`);
  }
  await assertNoStaleExpo57StateAsync({ root: projectRoot, mode: 'generated-app' });

  const environment = {
    BUN_INSTALL_CACHE_DIR: path.join(cacheRoot, 'bun-install'),
    EXPO_NO_TELEMETRY: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
  };
  await runCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    environment,
    label: 'Generate standalone template lockfile',
  });
  await rm(path.join(projectRoot, 'node_modules'), { force: true, recursive: true });
  const lockfilePath = path.join(projectRoot, 'bun.lock');
  const lockfileDigest = hash(await readFile(lockfilePath));
  await runCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    environment,
    label: 'Cold standalone template install',
  });
  if (lockfileDigest !== hash(await readFile(lockfilePath))) {
    throw new Error(`${projectRoot} mutated its frozen lockfile.`);
  }

  const localBin = path.join(projectRoot, 'node_modules', '.bin');
  const commands = [
    [path.join(localBin, 'tsc'), ['--noEmit'], 'Template TypeScript'],
    [path.join(localBin, 'expo'), ['install', '--check'], 'Template Expo compatibility'],
    [path.join(localBin, 'expo-doctor'), [], 'Template Expo Doctor'],
  ];
  for (const [command, args, label] of commands) {
    if (!(await pathExistsAsync(command))) {
      throw new Error(`${label} must use the app-owned executable ${command}.`);
    }
    await runCommandAsync({ args, command, cwd: projectRoot, environment, label });
  }
}

async function assertRegistryInstalledStudioAsync(root) {
  const declaration = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const requestedRange = declaration.dependencies?.['@ankhorage/studio'];
  if (requestedRange !== '^2.0.9') {
    throw new Error(
      `Acceptance fixture declares unexpected Studio range ${String(requestedRange)}.`,
    );
  }
  const packageRoot = path.join(root, 'node_modules', '@ankhorage', 'studio');
  const packageStat = await stat(packageRoot);
  if (!packageStat.isDirectory())
    throw new Error('Installed Studio package root is not a directory.');
  const installedRoot = await realpath(packageRoot);
  if (!isWithin(installedRoot, root)) {
    throw new Error(`Installed Studio package escapes the fixture root: ${installedRoot}`);
  }
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (!isCompatibleStudioVersion(packageJson.version)) {
    throw new Error(`Installed Studio ${String(packageJson.version)} does not satisfy ^2.0.9.`);
  }
  const lockfile = await readFile(path.join(root, 'bun.lock'), 'utf8');
  if (/(?:file|link|workspace):/u.test(lockfile)) {
    throw new Error('Fixture lockfile contains a non-Registry dependency shortcut.');
  }
  return packageJson.version;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isCompatibleStudioVersion(version) {
  if (typeof version !== 'string') return false;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/u.exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return major === 2 && (minor > 0 || (minor === 0 && patch >= 9));
}

function isWithin(target, parent) {
  const relativePath = path.relative(parent, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function parseShard(rawValue) {
  const match = /^(\d+)\/(\d+)$/u.exec(rawValue);
  if (!match) throw new Error(`Invalid ANKH_EXPO57_TEMPLATE_SHARD '${rawValue}'. Use N/M.`);
  const requestedIndex = Number(match[1]);
  const total = Number(match[2]);
  if (requestedIndex < 1 || total < 1 || requestedIndex > total) {
    throw new Error(`Invalid template shard '${rawValue}'.`);
  }
  return { index: requestedIndex - 1, total };
}

async function pathExistsAsync(target) {
  return (await stat(target).catch(() => null)) !== null;
}

async function runCommandAsync({ args, command, cwd, environment, label }) {
  console.log(`\n--- ${label} ---`);
  const child = Bun.spawn([command, ...args], {
    cwd,
    env: { ...process.env, ...environment },
    stderr: 'inherit',
    stdout: 'inherit',
  });
  let timeout;
  const exitCode = await new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${label} timed out after ${commandTimeoutMs}ms.`));
    }, commandTimeoutMs);
    void child.exited.then(resolve, reject);
  }).finally(() => clearTimeout(timeout));
  if (exitCode !== 0) throw new Error(`${label} failed with exit code ${exitCode}.`);
}
