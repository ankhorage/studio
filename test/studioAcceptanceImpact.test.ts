import { readFile } from 'node:fs/promises';

import { createCiImpactWorkflowOutput, planCiImpact } from '@ankhorage/devtools/ci-impact';
import { SEMVER_PATTERNS } from '@ankhorage/utility/semver';
import { expect, test } from 'bun:test';

const acceptanceScripts = [
  'ci:acceptance:expo-web',
  'ci:acceptance:sharkprey',
  'ci:acceptance:studio-standalone',
  'ci:acceptance:generated-app',
  'ci:acceptance:generated-navigation',
  'ci:acceptance:generated-capabilities',
] as const;

test('uses published per-job decisions and fails closed for non-documentation changes', async () => {
  const manifest = await readStudioManifestAsync();
  const output = createOutput(['src/host/layout/layoutGenerator.ts'], manifest);

  expect(Object.keys(output.jobs)).toEqual([...acceptanceScripts]);
  expect(Object.values(output.jobs)).toEqual(
    acceptanceScripts.map(() => ({
      fallback: true,
      reason: 'No complete suite mapping',
      state: 'full',
    })),
  );
});

test('declares the verified published planner minimum while keeping e2e ownership incomplete', async () => {
  const manifest = await readStudioManifestAsync();

  expect(manifest.devDependencies['@ankhorage/devtools']).toMatch(SEMVER_PATTERNS.caret);
  expect(manifest.ankh.ciImpact.complete).toEqual({ e2e: false });
});

test('installs the standalone Studio consumer before its web e2e spawns Expo', async () => {
  const manifest = await readStudioManifestAsync();

  expect(manifest.scripts['test:e2e:generated-app-web']).toStartWith(
    'bun install --cwd apps/studio --frozen-lockfile &&',
  );
});

test('allows only the published planner to skip the documented acceptance matrix', async () => {
  const manifest = await readStudioManifestAsync();
  const output = createOutput(['docs/ci-impact.md'], manifest);

  expect(Object.values(output.jobs)).toEqual(
    acceptanceScripts.map(() => ({
      fallback: false,
      reason: 'Documentation only',
      state: 'skipped',
    })),
  );
});

test('keeps an always-running aggregation gate for the published job decisions', async () => {
  const workflow = await readFile('.github/workflows/studio-acceptance.yml', 'utf8');

  expect(workflow).toContain('acceptance:\n    needs:');
  expect(workflow).toContain('if: always()');
  expect(workflow).toContain('bun .github/scripts/ci-impact.ts plan');
  expect(workflow).not.toContain('determine-studio-acceptance-scope');
  for (const script of acceptanceScripts) expect(workflow).toContain(script);
});

async function readStudioManifestAsync(): Promise<{
  ankh: {
    ciImpact: {
      complete: { e2e: false };
      suites: readonly { kind: 'e2e'; paths: readonly string[]; script: string }[];
    };
  };
  devDependencies: Readonly<Record<string, string>>;
  scripts: Readonly<Record<string, string>>;
}> {
  return JSON.parse(await readFile('package.json', 'utf8'));
}

function createOutput(
  files: readonly string[],
  manifest: Awaited<ReturnType<typeof readStudioManifestAsync>>,
) {
  const configuration = manifest.ankh.ciImpact;
  return createCiImpactWorkflowOutput(
    planCiImpact(files, manifest.scripts, configuration, 'a'.repeat(40)),
    configuration,
  );
}
