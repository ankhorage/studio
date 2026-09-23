import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import { SEMVER_PATTERNS } from '@ankhorage/utility/semver';

const execFileAsync = promisify(execFile);
const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const COMMAND_TIMEOUT_MS = 300_000;
const { oldVersion: OLD_STUDIO_VERSION, currentVersion: CURRENT_STUDIO_VERSION } =
  await resolvePublishedStudioRestartBoundaryAsync();
const USER_FILE_NAME = 'USER_NOTES.md';
const USER_FILE_CONTENT = '# User-owned restart-boundary note\n';

const repositoryRoot = process.cwd();
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'ankh-published-studio-restart-'));
const oldToolRoot = path.join(fixtureRoot, 'studio-old');
const currentToolRoot = path.join(fixtureRoot, 'studio-current');
const workspaceRoot = path.join(fixtureRoot, 'workspace');
const cacheRoot = path.join(fixtureRoot, 'cache');
const port = await findFreePortAsync();

try {
  await Promise.all(
    [oldToolRoot, currentToolRoot, workspaceRoot, cacheRoot].map((root) =>
      mkdir(root, { recursive: true }),
    ),
  );
  await Promise.all([
    installPublishedStudioAsync(oldToolRoot, OLD_STUDIO_VERSION),
    installPublishedStudioAsync(currentToolRoot, CURRENT_STUDIO_VERSION),
  ]);
  const oldVersions = await assertPublishedStudioAsync(oldToolRoot, OLD_STUDIO_VERSION);
  const currentVersions = await assertPublishedStudioAsync(currentToolRoot, CURRENT_STUDIO_VERSION);

  const oldHost = await startPublishedStudioHostAsync(oldToolRoot);
  const projectId = await runOldHostBoundaryAsync(oldHost);
  const projectRoot = path.join(workspaceRoot, 'apps', projectId);

  const currentHost = await startPublishedStudioHostAsync(currentToolRoot);
  try {
    await waitForHostAsync(currentHost);
    const currentStatus = await statusProjectAsync(projectId);
    assertStudioHost(currentStatus, CURRENT_STUDIO_VERSION);
    const currentPlan = await planProjectAsync(
      projectId,
      resolveStudioPackageSelector(currentStatus),
    );
    assert.equal(readOwnProperty(currentPlan, 'complete'), true);
    assert.equal(findByCode(currentPlan, 'blockers', 'plan.host-upgrade-required'), undefined);
    assert.equal(studioTargetVersion(currentPlan), CURRENT_STUDIO_VERSION);
    const currentPlanId = readRequiredString(currentPlan, 'id');
    const oldPlanId = readRequiredString(
      await readJsonObjectAsync(path.join(fixtureRoot, 'old-plan.json')),
      'id',
    );
    assert.notEqual(currentPlanId, oldPlanId);

    const beforeApply = await readMutationSentinelsAsync(projectRoot);
    const apply = await requestJsonAsync(
      `/api/projects/${encodeURIComponent(projectId)}/updates/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          plan: currentPlan,
          permissions: { ownerCode: true, lifecycleScripts: true, externalEffects: true },
        }),
      },
    );
    assert.equal(readOwnProperty(apply, 'status'), 'completed');
    const operationId = readRequiredString(apply, 'operationId');
    const verify = await requestJsonAsync(
      `/api/projects/${encodeURIComponent(projectId)}/updates/verify`,
      { method: 'POST', body: JSON.stringify({ operationId }) },
    );
    assert.equal(readOwnProperty(verify, 'verified'), true);
    assert.equal(await installedStudioVersionAsync(projectRoot), CURRENT_STUDIO_VERSION);
    assert.equal(await readFile(path.join(projectRoot, USER_FILE_NAME), 'utf8'), USER_FILE_CONTENT);
    assert.notEqual((await readMutationSentinelsAsync(projectRoot)).lockfile, beforeApply.lockfile);

    console.log(
      JSON.stringify(
        {
          oldStudioVersion: oldVersions.studioVersion,
          oldApmVersion: oldVersions.apmVersion,
          currentStudioVersion: currentVersions.studioVersion,
          currentApmVersion: currentVersions.apmVersion,
          packageManager: 'bun',
          projectId,
          oldPlanId,
          currentPlanId,
          blocker: 'plan.host-upgrade-required',
          verified: true,
          omittedPlatformEvidence: [
            'No cloud/store deployment is performed; this gate proves the host restart and project-update boundary only.',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await stopHostAsync(currentHost);
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

async function runOldHostBoundaryAsync(host: ReturnType<typeof spawn>): Promise<string> {
  try {
    await waitForHostAsync(host);
    const projectId = await createExistingProjectAsync();
    const projectRoot = path.join(workspaceRoot, 'apps', projectId);
    await retainOldStudioReleaseAsync(projectRoot);
    await writeFile(path.join(projectRoot, USER_FILE_NAME), USER_FILE_CONTENT, 'utf8');
    const before = await readMutationSentinelsAsync(projectRoot);
    const status = await statusProjectAsync(projectId);
    const studioHost = assertStudioHost(status, OLD_STUDIO_VERSION);
    assert.equal(
      readRequiredString(readObject(studioHost, 'availability'), 'latestVersion'),
      CURRENT_STUDIO_VERSION,
    );
    assert.notEqual(findByCode(studioHost, 'findings', 'host-update'), undefined);
    const plan = await planProjectAsync(projectId, resolveStudioPackageSelector(status));
    assert.equal(readOwnProperty(plan, 'complete'), false);
    assert.equal(studioTargetVersion(plan), CURRENT_STUDIO_VERSION);
    const blocker = findByCode(plan, 'blockers', 'plan.host-upgrade-required');
    if (blocker === undefined) {
      throw new Error('Old Studio host did not expose its restart prerequisite.');
    }
    assert.match(readRequiredString(blocker, 'nextAction'), /restart/u);
    assert.deepEqual(await readMutationSentinelsAsync(projectRoot), before);
    await writeJsonAsync(path.join(fixtureRoot, 'old-plan.json'), plan);
    return projectId;
  } finally {
    await stopHostAsync(host);
  }
}

/*** Resolve the immediately preceding and latest stable published Studio releases from npm. */
async function resolvePublishedStudioRestartBoundaryAsync(): Promise<{
  readonly oldVersion: string;
  readonly currentVersion: string;
}> {
  const { stdout } = await execFileAsync(
    'npm',
    ['view', STUDIO_PACKAGE_NAME, 'versions', '--json'],
    {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
    },
  );
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error('Published Studio version discovery must return an array.');
  }
  const stableVersions = [
    ...new Set(
      parsed.filter(
        (version): version is string =>
          typeof version === 'string' && SEMVER_PATTERNS.exact.test(version),
      ),
    ),
  ].sort(compareStableVersions);
  const currentVersion = stableVersions.at(-1);
  const oldVersion = stableVersions.at(-2);
  if (oldVersion === undefined || currentVersion === undefined) {
    throw new Error('Published Studio restart acceptance requires at least two stable releases.');
  }
  return { oldVersion, currentVersion };
}

/*** Compare two stable semantic versions numerically by major, minor, then patch. */
function compareStableVersions(left: string, right: string): number {
  const leftParts = readStableVersionParts(left);
  const rightParts = readStableVersionParts(right);
  return leftParts.reduce((difference, value, index) => {
    if (difference !== 0) return difference;
    return value - (rightParts.at(index) ?? 0);
  }, 0);
}

/*** Parse one stable semantic version into its numeric major, minor, and patch parts. */
function readStableVersionParts(version: string): readonly [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) throw new Error(`Invalid stable Studio version: ${version}.`);
  return [Number(match.at(1)), Number(match.at(2)), Number(match.at(3))];
}

/*** Reconstruct and validate the retained previous published lock state before the latest release. */
async function retainOldStudioReleaseAsync(projectRoot: string): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const manifest = await readJsonObjectAsync(packagePath);
  const section = studioDependencySection(manifest);
  const dependencies = readObject(manifest, section);
  const releaseRange = readRequiredString(dependencies, STUDIO_PACKAGE_NAME);
  assert.equal(releaseRange, `^${OLD_STUDIO_VERSION}`);

  await writeJsonAsync(packagePath, {
    ...manifest,
    [section]: { ...dependencies, [STUDIO_PACKAGE_NAME]: OLD_STUDIO_VERSION },
  });
  await runCommandAsync('bun', ['install', '--ignore-scripts'], projectRoot);
  assert.equal(await installedStudioVersionAsync(projectRoot), OLD_STUDIO_VERSION);

  const exactManifest = await readJsonObjectAsync(packagePath);
  await writeJsonAsync(packagePath, {
    ...exactManifest,
    [section]: {
      ...readObject(exactManifest, section),
      [STUDIO_PACKAGE_NAME]: releaseRange,
    },
  });
  await restoreBunLockReleaseRangeAsync(projectRoot, section, releaseRange);
  await runCommandAsync('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], projectRoot);
  assert.equal(await installedStudioVersionAsync(projectRoot), OLD_STUDIO_VERSION);
}

/*** Restore the historical semver declaration without changing the resolved published package. */
async function restoreBunLockReleaseRangeAsync(
  projectRoot: string,
  section: 'dependencies' | 'devDependencies',
  releaseRange: string,
): Promise<void> {
  const lockPath = path.join(projectRoot, 'bun.lock');
  const parsed: unknown = Bun.JSONC.parse(await readFile(lockPath, 'utf8'));
  if (!isRecord(parsed)) throw new Error('Expected Bun text lock object.');
  const workspaces = readObject(parsed, 'workspaces');
  const rootWorkspace = readObject(workspaces, '');
  const dependencies = readObject(rootWorkspace, section);
  assert.equal(readRequiredString(dependencies, STUDIO_PACKAGE_NAME), OLD_STUDIO_VERSION);
  await writeJsonAsync(lockPath, {
    ...parsed,
    workspaces: {
      ...workspaces,
      '': {
        ...rootWorkspace,
        [section]: { ...dependencies, [STUDIO_PACKAGE_NAME]: releaseRange },
      },
    },
  });
}

/*** Locate the generated project's Studio declaration without assuming dependency ownership. */
function studioDependencySection(
  manifest: Readonly<Record<string, unknown>>,
): 'dependencies' | 'devDependencies' {
  const sections = ['dependencies', 'devDependencies'] as const;
  const section = sections.find((candidate) => {
    const dependencies = readOwnProperty(manifest, candidate);
    return (
      isRecord(dependencies) &&
      typeof readOwnProperty(dependencies, STUDIO_PACKAGE_NAME) === 'string'
    );
  });
  if (section === undefined) {
    throw new Error('Generated project has no Studio dependency declaration.');
  }
  return section;
}

async function installPublishedStudioAsync(root: string, version: string): Promise<void> {
  await writeJsonAsync(path.join(root, 'package.json'), {
    name: `published-studio-${version}`,
    private: true,
    type: 'module',
    dependencies: { [STUDIO_PACKAGE_NAME]: version },
  });
  await runCommandAsync('bun', ['install', '--ignore-scripts'], root);
}

async function assertPublishedStudioAsync(
  root: string,
  expectedVersion: string,
): Promise<{ readonly studioVersion: string; readonly apmVersion: string }> {
  const studioPath = path.join(root, 'node_modules', '@ankhorage', 'studio', 'package.json');
  const apmPath = path.join(root, 'node_modules', '@ankhorage', 'apm', 'package.json');
  if (isWithin(path.dirname(studioPath), repositoryRoot)) {
    throw new Error('Restart acceptance resolved Studio from the repository checkout.');
  }
  const studio = await readJsonObjectAsync(studioPath);
  const apm = await readJsonObjectAsync(apmPath);
  assert.equal(readRequiredString(studio, 'version'), expectedVersion);
  return { studioVersion: expectedVersion, apmVersion: readRequiredString(apm, 'version') };
}

async function startPublishedStudioHostAsync(toolRoot: string) {
  const scriptPath = path.join(toolRoot, 'host.mjs');
  await writeFile(
    scriptPath,
    [
      "import { startStudioHostServer } from '@ankhorage/studio/host';",
      'const port = Number(process.env.STUDIO_PORT);',
      'const projectRoot = process.env.STUDIO_WORKSPACE_ROOT;',
      "if (!Number.isInteger(port) || !projectRoot) throw new Error('Missing host configuration.');",
      "const host = await startStudioHostServer({ host: '127.0.0.1', port, projectRoot });",
      "process.on('SIGTERM', () => void host.close().finally(() => process.exit(0)));",
      '',
    ].join('\n'),
    'utf8',
  );
  return spawn(process.execPath, [scriptPath], {
    cwd: toolRoot,
    env: { ...process.env, STUDIO_PORT: String(port), STUDIO_WORKSPACE_ROOT: workspaceRoot },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

async function createExistingProjectAsync(): Promise<string> {
  const catalog = await requestJsonAsync('/api/templates');
  const category = readArray(catalog, 'categories')
    .filter(isRecord)
    .find((candidate) => readArray(candidate, 'templates').length > 0);
  if (category === undefined) throw new Error('Published Studio exposed no project templates.');
  const [template] = readArray(category, 'templates');
  if (!isRecord(template)) throw new Error('Published Studio template catalog is malformed.');
  const created = await requestJsonAsync('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Published Studio Restart Boundary',
      category: readRequiredString(category, 'id'),
      slug: readRequiredString(template, 'slug'),
      includeStudio: true,
    }),
  });
  return readRequiredString(created, 'id');
}

async function statusProjectAsync(projectId: string) {
  return requestJsonAsync(
    `/api/projects/${encodeURIComponent(projectId)}/updates/status?availability=refresh`,
  );
}

async function planProjectAsync(
  projectId: string,
  selector: StudioPackageSelector,
): Promise<Readonly<Record<string, unknown>>> {
  const route = `/api/projects/${encodeURIComponent(projectId)}/updates/plan`;
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      availability: 'refresh',
      policy: {
        dependencyUpdates: 'selected',
        selections: [
          {
            selector,
            target: {
              kind: 'version',
              version: CURRENT_STUDIO_VERSION,
              manifestRange: `^${CURRENT_STUDIO_VERSION}`,
            },
          },
        ],
        repairInstallations: true,
        repairProjections: true,
      },
    }),
  });
  const body = await response.text();
  const value: unknown = JSON.parse(body);
  if (response.status !== 200 && response.status !== 409) {
    throw new Error(`POST ${route} failed (${response.status}): ${body}`);
  }
  if (!isRecord(value)) throw new Error(`Expected object JSON from ${route}.`);
  return value;
}

interface StudioPackageSelector {
  readonly name: string;
  readonly packageId: string;
  readonly installRootId: string;
  readonly ownerPath: string;
}

/*** Resolve the exact direct Studio package instance selected by the restart-boundary plan. */
function resolveStudioPackageSelector(
  status: Readonly<Record<string, unknown>>,
): StudioPackageSelector {
  const dependency = readArray(status, 'dependencies').find(
    (candidate) =>
      isRecord(candidate) &&
      readOwnProperty(candidate, 'name') === STUDIO_PACKAGE_NAME &&
      readOwnProperty(candidate, 'direct') === true,
  );
  if (!isRecord(dependency)) {
    throw new Error('Status did not expose the direct Studio project dependency.');
  }
  const declaration = readObject(dependency, 'declaration');
  return {
    name: STUDIO_PACKAGE_NAME,
    packageId: readRequiredString(dependency, 'packageId'),
    installRootId: readRequiredString(dependency, 'installRootId'),
    ownerPath: readRequiredString(declaration, 'ownerPath'),
  };
}

function assertStudioHost(
  status: Readonly<Record<string, unknown>>,
  version: string,
): Readonly<Record<string, unknown>> {
  const host = readArray(status, 'hosts').find(
    (candidate) =>
      isRecord(candidate) && readOwnProperty(candidate, 'name') === STUDIO_PACKAGE_NAME,
  );
  if (!isRecord(host)) throw new Error('Status did not expose the running Studio host package.');
  assert.equal(readRequiredString(host, 'version'), version);
  return host;
}

function studioTargetVersion(plan: Readonly<Record<string, unknown>>): string {
  const target = readArray(plan, 'targets').find(
    (candidate) =>
      isRecord(candidate) && readOwnProperty(candidate, 'name') === STUDIO_PACKAGE_NAME,
  );
  if (!isRecord(target)) {
    throw new Error(
      `Plan did not select a Studio owner target: ${JSON.stringify({
        blockers: readOwnProperty(plan, 'blockers'),
        policy: readOwnProperty(plan, 'policy'),
        targets: readOwnProperty(plan, 'targets'),
      })}`,
    );
  }
  return readRequiredString(target, 'targetVersion');
}

function findByCode(
  value: Readonly<Record<string, unknown>>,
  key: string,
  code: string,
): Readonly<Record<string, unknown>> | undefined {
  return readArray(value, key).find(
    (candidate): candidate is Readonly<Record<string, unknown>> =>
      isRecord(candidate) && readOwnProperty(candidate, 'code') === code,
  );
}

async function installedStudioVersionAsync(projectRoot: string): Promise<string> {
  const manifest = await readJsonObjectAsync(
    path.join(projectRoot, 'node_modules', '@ankhorage', 'studio', 'package.json'),
  );
  return readRequiredString(manifest, 'version');
}

async function readMutationSentinelsAsync(projectRoot: string) {
  return {
    packageJson: await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    lockfile: await readFile(path.join(projectRoot, 'bun.lock'), 'utf8'),
    userFile: await readFile(path.join(projectRoot, USER_FILE_NAME), 'utf8'),
  };
}

async function requestJsonAsync(
  route: string,
  init: RequestInit = {},
): Promise<Readonly<Record<string, unknown>>> {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await response.text();
  const value: unknown = JSON.parse(body);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${route} failed (${response.status}): ${body}`);
  }
  if (!isRecord(value)) throw new Error(`Expected object JSON from ${route}.`);
  return value;
}

async function runCommandAsync(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  await execFileAsync(command, [...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: cacheRoot },
    maxBuffer: 32 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
  });
}

async function waitForHostAsync(host: ReturnType<typeof spawn>): Promise<void> {
  for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
    if (host.exitCode !== null) {
      throw new Error(`Published Studio host exited with ${host.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await Promise.resolve();
    }
    await sleepAsync(Math.min(100 + attempt * 10, 500));
  }
  throw new Error('Published Studio host did not become ready.');
}

async function stopHostAsync(host: ReturnType<typeof spawn>): Promise<void> {
  if (host.exitCode !== null) return;
  const exited = new Promise<boolean>((resolve) => host.once('exit', () => resolve(true)));
  host.kill('SIGTERM');
  if (!(await Promise.race([exited, sleepAsync(5_000).then(() => false)]))) host.kill('SIGKILL');
}

async function readJsonObjectAsync(filePath: string): Promise<Readonly<Record<string, unknown>>> {
  const value: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!isRecord(value)) throw new Error(`Expected JSON object at ${filePath}.`);
  return value;
}

function readObject(
  value: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  const property = readOwnProperty(value, key);
  if (!isRecord(property)) throw new Error(`Expected ${key} to be an object.`);
  return property;
}

function readArray(value: Readonly<Record<string, unknown>>, key: string): readonly unknown[] {
  const property = readOwnProperty(value, key);
  if (!Array.isArray(property)) throw new Error(`Expected ${key} to be an array.`);
  return property;
}

function readRequiredString(value: unknown, key: string): string {
  if (!isRecord(value)) throw new Error(`Expected object while reading ${key}.`);
  const property = readOwnProperty(value, key);
  if (typeof property !== 'string' || property.length === 0) {
    throw new Error(`Expected ${key} to be a non-empty string.`);
  }
  return property;
}

async function writeJsonAsync(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isWithin(target: string, parent: string): boolean {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function findFreePortAsync(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve an acceptance port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function sleepAsync(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
