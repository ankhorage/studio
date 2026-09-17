import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { ProjectManager } from './orchestrator/projectManager';
import { type StudioInfraUpResult, upProjectInfrastructure } from './orchestrator/studioInfraUp';
import { getProjectTemplateSource, type ProjectTemplateSelection } from './templates';

const freshTemplateInfraTest =
  process.env.ANKH_STUDIO_FRESH_TEMPLATE_INFRA_E2E === '1' ? test : test.skip;
const preserveFailedInfrastructureForDiagnostics =
  process.env.ANKH_STUDIO_PRESERVE_FAILED_INFRA === '1';
const bootstrapEnvironmentVariable = 'SUPABASE_BOOTSTRAP';
const prefixedBootstrapEnvironmentVariable = 'ANKH_INFRA_CREDENTIAL_SUPABASE_BOOTSTRAP';
const privateBootstrapFieldNames = [
  'postgresPassword',
  'jwtSecret',
  'serviceRoleKey',
  'realtimeSecretKeyBase',
  'realtimeDatabaseEncryptionKey',
  'pgMetaCryptoKey',
] as const;

const heavyTemplateCases = [
  {
    name: 'SharkPrey Infra Acceptance',
    selection: { category: 'education_learning', slug: 'sharkprey' },
  },
  {
    name: 'Stillpath Infra Acceptance',
    selection: { category: 'lifestyle', slug: 'stillpath' },
  },
] as const satisfies readonly {
  readonly name: string;
  readonly selection: ProjectTemplateSelection;
}[];

for (const templateCase of heavyTemplateCases) {
  freshTemplateInfraTest(
    `runs fresh ${templateCase.selection.slug} Infra up without manual Supabase bootstrap credentials`,
    () => runFreshTemplateInfraAcceptanceAsync(templateCase),
    1_200_000,
  );
}

test('keeps the released Chat Supabase template credential-neutral', async () => {
  const source = await getProjectTemplateSource({ category: 'social_community', slug: 'chat' });
  expectCredentialNeutralLocalSupabaseManifest(source.manifest);
});

async function runFreshTemplateInfraAcceptanceAsync(templateCase: {
  readonly name: string;
  readonly selection: ProjectTemplateSelection;
}): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-studio538-infra-'));

  try {
    await createWorkspaceAsync(workspaceRoot);
    const source = await getProjectTemplateSource(templateCase.selection);
    expectCredentialNeutralLocalSupabaseManifest(source.manifest);

    const firstManager = new ProjectManager(workspaceRoot);
    const created = await firstManager.createProject(templateCase.name, source, undefined, {
      includeStudio: false,
    });
    let completed = false;

    try {
      const first = await upProjectInfrastructure({
        projectId: created.id,
        projectManager: firstManager,
        workspaceRoot,
      });
      const firstPublic = readSupabasePublicOutputs(first);
      expect(first.runtime).toBe('minikube');
      expect(firstPublic.url).toStartWith('http://127.0.0.1:');
      expect(firstPublic.anonKey.length).toBeGreaterThan(0);
      expectSafeStudioInfraResult(first);
      expect((await firstManager.getInfrastructureStatus(created.id)).state).toBe('ready');

      const secondManager = new ProjectManager(workspaceRoot);
      const second = await upProjectInfrastructure({
        projectId: created.id,
        projectManager: secondManager,
        workspaceRoot,
      });
      const secondPublic = readSupabasePublicOutputs(second);
      expect(secondPublic).toEqual(firstPublic);
      expect(resourceIdentities(second)).toEqual(resourceIdentities(first));
      expectSafeStudioInfraResult(second);

      await secondManager.downInfrastructure(created.id);

      const resumedManager = new ProjectManager(workspaceRoot);
      const resumed = await upProjectInfrastructure({
        projectId: created.id,
        projectManager: resumedManager,
        workspaceRoot,
      });
      expect(readSupabasePublicOutputs(resumed)).toEqual(firstPublic);
      expect(resourceIdentities(resumed)).toEqual(resourceIdentities(first));
      expectSafeStudioInfraResult(resumed);

      const health = await fetch(`${firstPublic.url}/auth/v1/health`);
      expect(health.ok).toBe(true);
      completed = true;
    } finally {
      if (completed || !preserveFailedInfrastructureForDiagnostics) {
        await new ProjectManager(workspaceRoot)
          .destroyInfrastructure(created.id, true)
          .catch(() => undefined);
      }
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function expectCredentialNeutralLocalSupabaseManifest(manifest: AppManifest): void {
  const { local } = manifest.infra.environments;
  expect(local.deployment.compute.provider).toBe('local');
  expect(local.deployment.runtime.provider).toBe('minikube');
  expect(local.database?.provider).toBe('supabase');
  expect(local.auth?.provider).toBe('supabase');

  const serialized = JSON.stringify(manifest.infra);
  expect(serialized).not.toContain(bootstrapEnvironmentVariable);
  expect(serialized).not.toContain(prefixedBootstrapEnvironmentVariable);
  for (const fieldName of privateBootstrapFieldNames) expect(serialized).not.toContain(fieldName);
}

function readSupabasePublicOutputs(result: StudioInfraUpResult): {
  readonly url: string;
  readonly anonKey: string;
} {
  const url = result.reconciled.outputs.find(
    ({ environmentVariable }) => environmentVariable === 'EXPO_PUBLIC_SUPABASE_URL',
  )?.value;
  const anonKey = result.reconciled.outputs.find(
    ({ environmentVariable }) => environmentVariable === 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  )?.value;
  if (typeof url !== 'string' || typeof anonKey !== 'string') {
    throw new Error('Expected string Supabase URL and anon-key outputs from Studio Infra up.');
  }
  return { url, anonKey };
}

function resourceIdentities(result: StudioInfraUpResult): readonly string[] {
  return result.reconciled.resources
    .map(({ identity }) =>
      [identity.projectId, identity.environment, identity.adapter, identity.resourceId].join(':'),
    )
    .sort();
}

function expectSafeStudioInfraResult(result: StudioInfraUpResult): void {
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain(bootstrapEnvironmentVariable);
  expect(serialized).not.toContain(prefixedBootstrapEnvironmentVariable);
  for (const fieldName of privateBootstrapFieldNames) expect(serialized).not.toContain(fieldName);
}

async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/studio-fresh-template-infra-acceptance',
        packageManager: 'bun@1.4.2',
        private: true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
