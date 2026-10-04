import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import {
  compareSemanticVersions,
  parseSemanticVersion,
  SEMVER_PATTERNS,
} from '@ankhorage/utility/semver';

const execFileAsync = promisify(execFile);
const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const COMMAND_TIMEOUT_MS = 300_000;
const STUDIO_VERSION = await resolveLatestPublishedStudioVersionAsync();
const DEPENDENCY_NAME = 'semver';
const INITIAL_DEPENDENCY_VERSION = '7.7.1';
const DEPENDENCY_RANGE = '^7.7.1';
const USER_FILE_NAME = 'USER_NOTES.md';
const USER_FILE_CONTENT = '# User-owned note\n\nAPM must preserve this file.\n';
const MANAGED_DEPENDENCY_CANDIDATES = [
  { name: '@ankhorage/contracts', section: 'dependencies' },
  { name: '@ankhorage/data-sources', section: 'dependencies' },
  { name: '@ankhorage/utility', section: 'dependencies' },
  { name: '@ankhorage/supabase-auth', section: 'dependencies' },
  { name: '@ankhorage/supabase-storage', section: 'dependencies' },
  { name: '@ankhorage/devtools', section: 'devDependencies' },
] as const;

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
    const projectId = await createExistingProjectAsync('Published Studio Existing App');
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

    const managedProjectId = await createExistingProjectAsync('Published Studio Managed Update');
    const managedProjectRoot = path.join(workspaceRoot, 'apps', managedProjectId);
    await writeFile(path.join(managedProjectRoot, USER_FILE_NAME), USER_FILE_CONTENT, 'utf8');
    const managedDrifts = await introduceGeneratedPolicyDriftAsync(managedProjectRoot);
    const managedBefore = await readMutationSentinelsAsync(managedProjectRoot);
    const managed = await runStudioManagedLifecycleAsync(
      managedProjectId,
      managedProjectRoot,
      managedDrifts,
    );
    assert.deepEqual(managed.readOnlySentinels, managedBefore);
    assert.equal(
      await readFile(path.join(managedProjectRoot, USER_FILE_NAME), 'utf8'),
      USER_FILE_CONTENT,
    );

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
          managedOwnerUpdate: {
            projectId: managedProjectId,
            drifted: managedDrifts.map(({ name, previousVersion }) => ({
              name,
              previousVersion,
            })),
            targets: managed.planTargets.map(({ name, currentVersion, targetVersion }) => ({
              name,
              currentVersion,
              targetVersion,
            })),
            verified: managed.verified,
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

/*** Resolve npm's current stable Studio release so acceptance cannot silently drift behind production. */
async function resolveLatestPublishedStudioVersionAsync(): Promise<string> {
  const { stdout } = await execFileAsync(
    'npm',
    ['view', STUDIO_PACKAGE_NAME, 'version', '--json'],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
    },
  );
  const value: unknown = JSON.parse(stdout);
  if (typeof value !== 'string' || !SEMVER_PATTERNS.exact.test(value)) {
    throw new Error('Published Studio version discovery returned no stable semantic version.');
  }
  return value;
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

type ManagedDependencySection = 'dependencies' | 'devDependencies';

interface ManagedDependencyDrift {
  readonly name: string;
  readonly section: ManagedDependencySection;
  readonly originalRange: string;
  readonly staleRange: string;
  readonly currentVersion: string;
  readonly previousVersion: string;
}

interface ManagedLifecycleEvidence {
  readonly readOnlySentinels: Readonly<Record<string, string>>;
  readonly planTargets: readonly PlanTargetEvidence[];
  readonly operationStatus: string;
  readonly verified: boolean;
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
    dependencies: { [STUDIO_PACKAGE_NAME]: STUDIO_VERSION },
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

async function createExistingProjectAsync(name: string): Promise<string> {
  const catalog = await requestJsonAsync('/api/templates');
  const categories = readArray(catalog, 'categories').filter(isRecord);
  const category = categories.find((candidate) => readArray(candidate, 'templates').length > 0);
  if (category === undefined) throw new Error('Published Studio exposed no project templates.');
  const [template] = readArray(category, 'templates');
  if (!isRecord(template)) throw new Error('Published Studio template catalog is malformed.');
  const created = await requestJsonAsync('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name,
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

/*** Materialize previous released versions for Studio-managed dependencies while keeping stale reviewed ranges. */
async function introduceGeneratedPolicyDriftAsync(
  projectRoot: string,
): Promise<readonly ManagedDependencyDrift[]> {
  const packagePath = path.join(projectRoot, 'package.json');
  await runCommandAsync('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], projectRoot);
  const manifest = await readJsonObjectAsync(packagePath);
  const candidates = await Promise.all(
    MANAGED_DEPENDENCY_CANDIDATES.map((candidate) =>
      resolveManagedDependencyDriftAsync(projectRoot, manifest, candidate),
    ),
  );
  const drifts = candidates.filter(
    (candidate): candidate is ManagedDependencyDrift => candidate !== undefined,
  );
  assert.ok(drifts.length >= 4, 'Expected at least four generated managed dependencies to drift.');

  await writeJsonAsync(packagePath, applyManagedDriftValues(manifest, drifts, 'exact'));
  await runCommandAsync('bun', ['install', '--ignore-scripts'], projectRoot);
  const installedManifest = await readJsonObjectAsync(packagePath);
  await writeJsonAsync(packagePath, applyManagedDriftValues(installedManifest, drifts, 'range'));

  await Promise.all(
    drifts.map(async ({ name, previousVersion }) => {
      assert.equal(await installedPackageVersionAsync(projectRoot, name), previousVersion);
    }),
  );
  return drifts;
}

/*** Resolve one previous-patch drift candidate from the generated manifest and installed graph. */
async function resolveManagedDependencyDriftAsync(
  projectRoot: string,
  manifest: Readonly<Record<string, unknown>>,
  candidate: (typeof MANAGED_DEPENDENCY_CANDIDATES)[number],
): Promise<ManagedDependencyDrift | undefined> {
  const section = readOptionalObject(manifest, candidate.section);
  const originalRange = readOwnProperty(section, candidate.name);
  if (typeof originalRange !== 'string') return undefined;
  const currentVersion = await installedPackageVersionAsync(projectRoot, candidate.name);
  const previousVersion = await resolvePreviousPatchVersionAsync(candidate.name, currentVersion);
  if (previousVersion === undefined) return undefined;
  return {
    name: candidate.name,
    section: candidate.section,
    originalRange,
    staleRange: `^${previousVersion}`,
    currentVersion,
    previousVersion,
  };
}

/*** Resolve the immediately preceding stable patch release for one installed package. */
async function resolvePreviousPatchVersionAsync(
  packageName: string,
  currentVersion: string,
): Promise<string | undefined> {
  const current = parseSemanticVersion(currentVersion);
  if (current === null) throw new Error(`Installed ${packageName} version is not stable semver.`);
  const { stdout } = await execFileAsync('npm', ['view', packageName, 'versions', '--json'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
  });
  const value: unknown = JSON.parse(stdout);
  if (!Array.isArray(value)) throw new Error(`npm versions for ${packageName} is not an array.`);
  const candidates = value.flatMap((entry) => {
    if (typeof entry !== 'string' || !SEMVER_PATTERNS.exact.test(entry)) return [];
    const parsed = parseSemanticVersion(entry);
    if (
      parsed?.major !== current.major ||
      parsed.minor !== current.minor ||
      compareSemanticVersions(parsed, current) >= 0
    ) {
      return [];
    }
    return [{ version: entry, parsed }];
  });
  return candidates
    .sort((left, right) => compareSemanticVersions(left.parsed, right.parsed))
    .at(-1)?.version;
}

/*** Apply exact previous versions or stale reviewed ranges without changing unrelated package metadata. */
function applyManagedDriftValues(
  manifest: Readonly<Record<string, unknown>>,
  drifts: readonly ManagedDependencyDrift[],
  mode: 'exact' | 'range',
): Readonly<Record<string, unknown>> {
  const dependencies = { ...readOptionalObject(manifest, 'dependencies') };
  const devDependencies = { ...readOptionalObject(manifest, 'devDependencies') };
  const updated = drifts.reduce<{
    readonly dependencies: Readonly<Record<string, unknown>>;
    readonly devDependencies: Readonly<Record<string, unknown>>;
  }>(
    (state, drift) => ({
      ...state,
      [drift.section]: {
        ...state[drift.section],
        [drift.name]: mode === 'exact' ? drift.previousVersion : drift.staleRange,
      },
    }),
    { dependencies, devDependencies },
  );
  return { ...manifest, ...updated };
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
  if (readOwnProperty(status, 'complete') !== true) {
    throw new Error(
      `Published Studio status is incomplete: ${JSON.stringify(
        {
          findings: readOwnProperty(status, 'findings'),
          diagnostics: readOwnProperty(status, 'diagnostics'),
        },
        null,
        2,
      )}`,
    );
  }
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

/*** Exercise Studio's package-owned generated-app projection through reviewed apply and verification. */
async function runStudioManagedLifecycleAsync(
  projectId: string,
  projectRoot: string,
  drifts: readonly ManagedDependencyDrift[],
): Promise<ManagedLifecycleEvidence> {
  const encodedId = encodeURIComponent(projectId);
  const status = await requestJsonAsync(
    `/api/projects/${encodedId}/updates/status?availability=refresh`,
  );
  assertManagedProjectionStale(status);
  const afterStatus = await readMutationSentinelsAsync(projectRoot);
  const plan = await requestJsonAsync(`/api/projects/${encodedId}/updates/plan`, {
    method: 'POST',
    body: JSON.stringify({ availability: 'refresh' }),
  });
  assertCompleteManagedPlan(plan);
  const readOnlySentinels = await readMutationSentinelsAsync(projectRoot);
  assert.deepEqual(readOnlySentinels, afterStatus);
  const planTargets = normalizePlanTargets(readArray(plan, 'targets'));
  assertManagedTargets(drifts, planTargets);

  const { operationStatus, verified } = await applyAndVerifyStudioPlanAsync(encodedId, plan);
  await assertManagedDriftsReconciledAsync(projectRoot, drifts);
  return { readOnlySentinels, planTargets, operationStatus, verified };
}

/*** Require current Studio owner evidence to report the generated package policy as stale. */
function assertManagedProjectionStale(status: Readonly<Record<string, unknown>>): void {
  assert.equal(readOwnProperty(status, 'complete'), true);
  const extensions = readObject(status, 'extensions');
  const observations = readArray(extensions, 'observations').filter(isRecord);
  assert.ok(
    observations.some(
      (observation) =>
        readOwnProperty(observation, 'owner') === STUDIO_PACKAGE_NAME &&
        readOwnProperty(observation, 'projection') === 'stale',
    ),
    'Expected generated package policy projection to be stale.',
  );
}

/*** Fail with bounded APM evidence when the real generated-app owner plan is incomplete. */
function assertCompleteManagedPlan(plan: Readonly<Record<string, unknown>>): void {
  if (readOwnProperty(plan, 'complete') === true) return;
  throw new Error(
    `Generated owner plan is incomplete: ${JSON.stringify(
      {
        blockers: readOwnProperty(plan, 'blockers'),
        diagnostics: readOwnProperty(plan, 'diagnostics'),
      },
      null,
      2,
    )}`,
  );
}

/*** Require every deliberately drifted managed package to be selected away from its previous version. */
function assertManagedTargets(
  drifts: readonly ManagedDependencyDrift[],
  targets: readonly PlanTargetEvidence[],
): void {
  for (const drift of drifts) {
    const target = targets.find(({ name }) => name === drift.name);
    assert.ok(target, `Missing reviewed target for ${drift.name}.`);
    assert.equal(target.currentVersion, drift.previousVersion);
    assert.notEqual(target.targetVersion, drift.previousVersion);
  }
}

/*** Apply one reviewed Studio plan and run the separate durable verification pass. */
async function applyAndVerifyStudioPlanAsync(
  encodedProjectId: string,
  plan: Readonly<Record<string, unknown>>,
): Promise<{ readonly operationStatus: string; readonly verified: boolean }> {
  const apply = await requestJsonAsync(`/api/projects/${encodedProjectId}/updates/apply`, {
    method: 'POST',
    body: JSON.stringify({
      plan,
      permissions: { ownerCode: true, lifecycleScripts: true, externalEffects: true },
    }),
  });
  const operationStatus = readRequiredString(apply, 'status');
  assert.equal(operationStatus, 'completed');
  const operationId = readRequiredString(apply, 'operationId');
  const verify = await requestJsonAsync(`/api/projects/${encodedProjectId}/updates/verify`, {
    method: 'POST',
    body: JSON.stringify({ operationId }),
  });
  const verified = readOwnProperty(verify, 'verified') === true;
  assert.equal(verified, true);
  return { operationStatus, verified };
}

/*** Confirm owner policy restored reviewed ranges and no drifted package remains on its previous version. */
async function assertManagedDriftsReconciledAsync(
  projectRoot: string,
  drifts: readonly ManagedDependencyDrift[],
): Promise<void> {
  const manifest = await readJsonObjectAsync(path.join(projectRoot, 'package.json'));
  await Promise.all(
    drifts.map(async (drift) => {
      const section = readOptionalObject(manifest, drift.section);
      assert.equal(readOwnProperty(section, drift.name), drift.originalRange);
      assert.notEqual(
        await installedPackageVersionAsync(projectRoot, drift.name),
        drift.previousVersion,
      );
    }),
  );
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
  const planPath = path.join(cliToolRoot, 'apm-plan.json');
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
    statusFindings: normalizeStatusFindings(readArray(status, 'findings')),
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
  assert.deepEqual(
    studio.statusFindings.filter(
      ({ code }) => code !== 'host-update' && code !== 'projection-stale',
    ),
    cli.statusFindings,
  );
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

function normalizeStatusFindings(values: readonly unknown[]): readonly PresentationFinding[] {
  const findings = normalizeFindings(values);
  return findings.filter(
    (finding, index) =>
      findings.findIndex(
        (candidate) =>
          candidate.code === finding.code &&
          candidate.reason === finding.reason &&
          candidate.nextAction === finding.nextAction,
      ) === index,
  );
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
  return installedPackageVersionAsync(projectRoot, DEPENDENCY_NAME);
}

/*** Read one installed package version from the generated app's physical node_modules graph. */
async function installedPackageVersionAsync(
  projectRoot: string,
  packageName: string,
): Promise<string> {
  const manifest = await readJsonObjectAsync(
    path.join(projectRoot, 'node_modules', ...packageName.split('/'), 'package.json'),
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
