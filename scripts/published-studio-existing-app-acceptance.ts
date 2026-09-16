import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

const execFileAsync = promisify(execFile);
const STUDIO_VERSION = '2.7.6';
const DEPENDENCY_NAME = 'semver';
const INITIAL_DEPENDENCY_VERSION = '7.7.1';
const DEPENDENCY_RANGE = '^7.7.1';
const COMMAND_TIMEOUT_MS = 300_000;
const USER_FILE_NAME = 'USER_NOTES.md';
const USER_FILE_CONTENT = '# User-owned note\n\nAPM must preserve this file.\n';

const repositoryRoot = process.cwd();
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'ankh-published-studio-update-'));
const studioToolRoot = path.join(fixtureRoot, 'studio-tool');
const workspaceRoot = path.join(fixtureRoot, 'workspace');
const cliProjectRoot = path.join(fixtureRoot, 'cli-project');
const cliToolRoot = path.join(fixtureRoot, 'cli-tool');
const cacheRoot = path.join(fixtureRoot, 'cache');
const port = await findFreePortAsync();

try {
  await Promise.all([
    mkdir(studioToolRoot, { recursive: true }),
    mkdir(workspaceRoot, { recursive: true }),
    mkdir(cliToolRoot, { recursive: true }),
    mkdir(cacheRoot, { recursive: true }),
  ]);
  await installPublishedStudioAsync();
  const versions = await assertPublishedStudioConsumerAsync();
  const host = await startPublishedStudioHostAsync();
  try {
    await waitForHostAsync(host);
    const projectId = await createExistingProjectAsync();
    const projectRoot = path.join(workspaceRoot, 'apps', projectId);
    await introduceSupportedDependencyDriftAsync(projectRoot);
    await writeFile(path.join(projectRoot, USER_FILE_NAME), USER_FILE_CONTENT, 'utf8');
    await copyProjectBaselineAsync(projectRoot, cliProjectRoot);
    await installProjectAsync(cliProjectRoot);

    const before = await readMutationSentinelsAsync(projectRoot);
    const studio = await runStudioLifecycleAsync(projectId, projectRoot);
    assert.deepEqual(studio.readOnlySentinels, before);

    await installPublishedApmCliAsync(versions.apmVersion);
    const cli = await runCliLifecycleAsync(cliProjectRoot);
    assertLifecycleParity(studio, cli);

    const studioInstalled = await installedDependencyVersionAsync(projectRoot);
    const cliInstalled = await installedDependencyVersionAsync(cliProjectRoot);
    assert.equal(studioInstalled, studio.targetVersion);
    assert.equal(cliInstalled, cli.targetVersion);
    assert.equal(studioInstalled, cliInstalled);
    assert.equal(
      await readFile(path.join(projectRoot, 'bun.lock'), 'utf8'),
      await readFile(path.join(cliProjectRoot, 'bun.lock'), 'utf8'),
    );
    assert.equal(await readFile(path.join(projectRoot, USER_FILE_NAME), 'utf8'), USER_FILE_CONTENT);

    console.log(
      JSON.stringify(
        {
          studioVersion: versions.studioVersion,
          apmVersion: versions.apmVersion,
          packageManager: 'bun',
          projectId,
          dependency: DEPENDENCY_NAME,
          from: INITIAL_DEPENDENCY_VERSION,
          to: studio.targetVersion,
          parity: {
            findings: studio.statusFindings.length,
            targets: studio.planTargets.length,
            planEffects: studio.planEffects.length,
            followUp: studio.followUp.length,
          },
          omittedPlatformEvidence: [
            'No cloud/store deployment is performed; shipment work is compared as structured APM follow-up evidence.',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await stopHostAsync(host);
  }
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

interface LifecycleEvidence {
  readonly targetVersion: string;
  readonly operationStatus: string;
  readonly verified: boolean;
  readonly statusFindings: readonly PresentationFinding[];
  readonly planTargets: readonly PlanTargetEvidence[];
  readonly planEffects: readonly unknown[];
  readonly verificationFindings: readonly PresentationFinding[];
  readonly followUp: readonly unknown[];
}

interface StudioLifecycleEvidence extends LifecycleEvidence {
  readonly readOnlySentinels: Readonly<Record<string, string>>;
}

interface PresentationFinding {
  readonly code: string;
  readonly reason: string;
  readonly nextAction?: string;
}

interface PlanTargetEvidence {
  readonly name: string;
  readonly direct: boolean;
  readonly currentVersion?: string;
  readonly targetVersion: string;
  readonly source: string;
  readonly reason: string;
}

async function installPublishedStudioAsync(): Promise<void> {
  await writeJsonAsync(path.join(studioToolRoot, 'package.json'), {
    name: 'published-studio-existing-app-consumer',
    private: true,
    type: 'module',
    dependencies: { '@ankhorage/studio': STUDIO_VERSION },
  });
  await runCommandAsync('bun', ['install', '--ignore-scripts'], studioToolRoot);
}

async function assertPublishedStudioConsumerAsync(): Promise<{
  readonly studioVersion: string;
  readonly apmVersion: string;
}> {
  const consumerManifest = await readJsonObjectAsync(path.join(studioToolRoot, 'package.json'));
  assert.deepEqual(Object.keys(readObject(consumerManifest, 'dependencies')), [
    '@ankhorage/studio',
  ]);

  const studioPackagePath = path.join(
    studioToolRoot,
    'node_modules',
    '@ankhorage',
    'studio',
    'package.json',
  );
  const apmPackagePath = path.join(
    studioToolRoot,
    'node_modules',
    '@ankhorage',
    'apm',
    'package.json',
  );
  const studioPackage = await readJsonObjectAsync(studioPackagePath);
  const apmPackage = await readJsonObjectAsync(apmPackagePath);
  if (isWithin(path.dirname(studioPackagePath), repositoryRoot)) {
    throw new Error('Published Studio acceptance resolved Studio from the repository checkout.');
  }
  assert.equal(readOwnProperty(studioPackage, 'version'), STUDIO_VERSION);
  return {
    studioVersion: readRequiredString(studioPackage, 'version'),
    apmVersion: readRequiredString(apmPackage, 'version'),
  };
}

async function startPublishedStudioHostAsync() {
  const hostScriptPath = path.join(studioToolRoot, 'host.mjs');
  await writeFile(
    hostScriptPath,
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
  return spawn(process.execPath, [hostScriptPath], {
    cwd: studioToolRoot,
    env: {
      ...process.env,
      STUDIO_PORT: String(port),
      STUDIO_WORKSPACE_ROOT: workspaceRoot,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

async function stopHostAsync(host: ReturnType<typeof spawn>): Promise<void> {
  if (host.exitCode !== null) return;
  const exited = new Promise<boolean>((resolve) => host.once('exit', () => resolve(true)));
  host.kill('SIGTERM');
  const graceful = await Promise.race([exited, sleepAsync(5_000).then(() => false)]);
  if (!graceful) host.kill('SIGKILL');
}

async function waitForHostAsync(host: ReturnType<typeof spawn>): Promise<void> {
  for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
    if (host.exitCode !== null) {
      throw new Error(`Published Studio host exited before readiness with code ${host.exitCode}.`);
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

async function createExistingProjectAsync(): Promise<string> {
  const catalog = await requestJsonAsync('/api/templates');
  const categories = readArray(catalog, 'categories').filter(isRecord);
  const category = categories.find((candidate) => readArray(candidate, 'templates').length > 0);
  if (category === undefined) throw new Error('Published Studio exposed no project templates.');
  const [template] = readArray(category, 'templates');
  if (!isRecord(template)) throw new Error('Published Studio template catalog is malformed.');
  const created = await requestJsonAsync('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Published Studio Existing App',
      category: readRequiredString(category, 'id'),
      slug: readRequiredString(template, 'slug'),
      includeStudio: true,
    }),
  });
  return readRequiredString(created, 'id');
}

async function introduceSupportedDependencyDriftAsync(projectRoot: string): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const manifest = await readJsonObjectAsync(packagePath);
  await writeJsonAsync(packagePath, {
    ...manifest,
    dependencies: {
      ...readOptionalObject(manifest, 'dependencies'),
      [DEPENDENCY_NAME]: INITIAL_DEPENDENCY_VERSION,
    },
  });
  await runCommandAsync('bun', ['install', '--ignore-scripts'], projectRoot);
  const installedManifest = await readJsonObjectAsync(packagePath);
  await writeJsonAsync(packagePath, {
    ...installedManifest,
    dependencies: {
      ...readOptionalObject(installedManifest, 'dependencies'),
      [DEPENDENCY_NAME]: DEPENDENCY_RANGE,
    },
  });
  assert.equal(await installedDependencyVersionAsync(projectRoot), INITIAL_DEPENDENCY_VERSION);
}

async function copyProjectBaselineAsync(source: string, target: string): Promise<void> {
  await cp(source, target, {
    recursive: true,
    filter: (candidate) => !candidate.split(path.sep).includes('node_modules'),
  });
}

async function installProjectAsync(projectRoot: string): Promise<void> {
  await runCommandAsync('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], projectRoot);
}

async function runStudioLifecycleAsync(
  projectId: string,
  projectRoot: string,
): Promise<StudioLifecycleEvidence> {
  const encodedId = encodeURIComponent(projectId);
  const status = await requestJsonAsync(
    `/api/projects/${encodedId}/updates/status?availability=refresh`,
  );
  assert.equal(readOwnProperty(status, 'complete'), true);
  const afterStatus = await readMutationSentinelsAsync(projectRoot);
  const plan = await requestJsonAsync(`/api/projects/${encodedId}/updates/plan`, {
    method: 'POST',
    body: JSON.stringify({ availability: 'refresh' }),
  });
  assert.equal(readOwnProperty(plan, 'complete'), true);
  const readOnlySentinels = await readMutationSentinelsAsync(projectRoot);
  assert.deepEqual(readOnlySentinels, afterStatus);
  const targetVersion = dependencyTargetVersion(plan);

  const apply = await requestJsonAsync(`/api/projects/${encodedId}/updates/apply`, {
    method: 'POST',
    body: JSON.stringify({
      plan,
      permissions: { ownerCode: true, lifecycleScripts: true, externalEffects: true },
    }),
  });
  const operationStatus = readRequiredString(apply, 'status');
  assert.equal(operationStatus, 'completed');
  const operationId = readRequiredString(apply, 'operationId');
  const verify = await requestJsonAsync(`/api/projects/${encodedId}/updates/verify`, {
    method: 'POST',
    body: JSON.stringify({ operationId }),
  });
  assert.equal(readOwnProperty(verify, 'verified'), true);

  return {
    ...lifecycleEvidence(status, plan, verify, targetVersion, operationStatus),
    readOnlySentinels,
  };
}

async function installPublishedApmCliAsync(apmVersion: string): Promise<void> {
  await writeJsonAsync(path.join(cliToolRoot, 'package.json'), {
    name: 'published-apm-parity-consumer',
    private: true,
    type: 'module',
    dependencies: { '@ankhorage/apm': apmVersion },
  });
  await runCommandAsync('bun', ['install', '--ignore-scripts'], cliToolRoot);
}

async function runCliLifecycleAsync(projectRoot: string): Promise<LifecycleEvidence> {
  const apm = path.join(cliToolRoot, 'node_modules', '.bin', 'apm');
  const status = await runJsonCommandAsync(apm, ['status', projectRoot, '--json'], cliToolRoot);
  assert.equal(readOwnProperty(status, 'complete'), true);
  const plan = await runJsonCommandAsync(apm, ['plan', projectRoot, '--json'], cliToolRoot);
  assert.equal(readOwnProperty(plan, 'complete'), true);
  const targetVersion = dependencyTargetVersion(plan);
  const planPath = path.join(projectRoot, 'apm-plan.json');
  await writeJsonAsync(planPath, plan);
  const apply = await runJsonCommandAsync(
    apm,
    [
      'apply',
      '--plan',
      planPath,
      '--json',
      '--allow-owner-code',
      '--allow-lifecycle-scripts',
      '--allow-external-effects',
    ],
    cliToolRoot,
  );
  const operationStatus = readRequiredString(apply, 'status');
  assert.equal(operationStatus, 'completed');
  const operationId = readRequiredString(apply, 'operationId');
  const verify = await runJsonCommandAsync(
    apm,
    ['verify', '--operation', operationId, projectRoot, '--json'],
    cliToolRoot,
  );
  assert.equal(readOwnProperty(verify, 'verified'), true);
  return lifecycleEvidence(status, plan, verify, targetVersion, operationStatus);
}

function lifecycleEvidence(
  status: Readonly<Record<string, unknown>>,
  plan: Readonly<Record<string, unknown>>,
  verify: Readonly<Record<string, unknown>>,
  targetVersion: string,
  operationStatus: string,
): LifecycleEvidence {
  return {
    targetVersion,
    operationStatus,
    verified: readOwnProperty(verify, 'verified') === true,
    statusFindings: normalizeFindings(readArray(status, 'findings')),
    planTargets: normalizePlanTargets(readArray(plan, 'targets')),
    planEffects: readArray(plan, 'effects'),
    verificationFindings: normalizeFindings(readArray(verify, 'findings')),
    followUp: readArray(verify, 'followUp'),
  };
}

function assertLifecycleParity(studio: LifecycleEvidence, cli: LifecycleEvidence): void {
  assert.equal(studio.targetVersion, cli.targetVersion);
  assert.equal(studio.operationStatus, cli.operationStatus);
  assert.equal(studio.verified, cli.verified);
  assert.deepEqual(studio.statusFindings, cli.statusFindings);
  assert.deepEqual(studio.planTargets, cli.planTargets);
  assert.deepEqual(studio.planEffects, cli.planEffects);
  assert.deepEqual(studio.verificationFindings, cli.verificationFindings);
  assert.deepEqual(studio.followUp, cli.followUp);
}

function normalizeFindings(values: readonly unknown[]): readonly PresentationFinding[] {
  return values.filter(isRecord).map((finding) => ({
    code: readRequiredString(finding, 'code'),
    reason: readRequiredString(finding, 'reason'),
    ...(typeof readOwnProperty(finding, 'nextAction') === 'string'
      ? { nextAction: readRequiredString(finding, 'nextAction') }
      : {}),
  }));
}

function normalizePlanTargets(values: readonly unknown[]): readonly PlanTargetEvidence[] {
  return values.filter(isRecord).map((target) => ({
    name: readRequiredString(target, 'name'),
    direct: readOwnProperty(target, 'direct') === true,
    ...(typeof readOwnProperty(target, 'currentVersion') === 'string'
      ? { currentVersion: readRequiredString(target, 'currentVersion') }
      : {}),
    targetVersion: readRequiredString(target, 'targetVersion'),
    source: readRequiredString(target, 'source'),
    reason: readRequiredString(target, 'reason'),
  }));
}

async function readMutationSentinelsAsync(
  projectRoot: string,
): Promise<Readonly<Record<string, string>>> {
  return {
    packageJson: await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    lockfile: await readFile(path.join(projectRoot, 'bun.lock'), 'utf8'),
    userFile: await readFile(path.join(projectRoot, USER_FILE_NAME), 'utf8'),
  };
}

async function installedDependencyVersionAsync(projectRoot: string): Promise<string> {
  const manifest = await readJsonObjectAsync(
    path.join(projectRoot, 'node_modules', DEPENDENCY_NAME, 'package.json'),
  );
  return readRequiredString(manifest, 'version');
}

function dependencyTargetVersion(plan: Readonly<Record<string, unknown>>): string {
  const target = readArray(plan, 'targets').find(
    (candidate) => isRecord(candidate) && readOwnProperty(candidate, 'name') === DEPENDENCY_NAME,
  );
  if (!isRecord(target)) throw new Error(`Plan did not select ${DEPENDENCY_NAME}.`);
  assert.equal(readOwnProperty(target, 'currentVersion'), INITIAL_DEPENDENCY_VERSION);
  const version = readRequiredString(target, 'targetVersion');
  assert.notEqual(version, INITIAL_DEPENDENCY_VERSION);
  return version;
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
    throw new Error(
      `${init.method ?? 'GET'} ${route} failed (${response.status}): ${JSON.stringify(compactHttpFailure(value))}`,
    );
  }
  if (!isRecord(value)) throw new Error(`Expected object JSON from ${route}.`);
  return value;
}

/*** Keep failed lifecycle output bounded to actionable structured evidence. */
function compactHttpFailure(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    status: readOwnProperty(value, 'status'),
    operationId: readOwnProperty(value, 'operationId'),
    planId: readOwnProperty(value, 'planId'),
    blockers: readOwnProperty(value, 'blockers'),
    diagnostics: readOwnProperty(value, 'diagnostics'),
  };
}

async function runJsonCommandAsync(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<Readonly<Record<string, unknown>>> {
  const stdout = await runCommandAsync(command, args, cwd);
  const value: unknown = JSON.parse(extractJson(stdout));
  if (!isRecord(value)) throw new Error(`Expected object JSON from ${command}.`);
  return value;
}

async function runCommandAsync(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<string> {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, BUN_INSTALL_CACHE_DIR: cacheRoot },
      maxBuffer: 32 * 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
    });
    return String(result.stdout);
  } catch (error) {
    if (!isRecord(error)) throw error;
    throw new Error(
      `${command} ${args.join(' ')} failed\nstdout:\n${String(readOwnProperty(error, 'stdout') ?? '')}\nstderr:\n${String(readOwnProperty(error, 'stderr') ?? '')}`,
      { cause: error },
    );
  }
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

function readOptionalObject(
  value: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  const property = readOwnProperty(value, key);
  if (property === undefined) return {};
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

function extractJson(stdout: string): string {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Command did not emit JSON:\n${stdout}`);
  return stdout.slice(start, end + 1);
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
