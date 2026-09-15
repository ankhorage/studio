import type { AppManifest } from '@ankhorage/contracts';
import type { InfraGenerateResult, InfraUpResult } from '@ankhorage/infra';
import { describe, expect, test } from 'bun:test';

import { upProjectInfrastructure } from './studioInfraUp';

const manifest: AppManifest = {
  metadata: {
    name: 'Demo',
    slug: 'demo',
    version: '1.0.0',
    category: 'developer_tools',
    themeId: 'default',
  },
  settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  infra: {
    environments: {
      local: { deployment: { compute: { provider: 'local' }, runtime: { provider: 'minikube' } } },
    },
    modules: [],
  },
  navigator: { type: 'stack', routes: [] },
  screens: {},
  themes: [],
  activeThemeId: 'default',
};
const ledger = {
  schemaVersion: 1 as const,
  projectId: 'project-one',
  environment: 'local' as const,
  targets: [],
  resources: [],
  outputs: [],
  artifacts: [],
};
const regenerated: InfraGenerateResult = { environment: 'local', artifacts: [], ledger };
const reconciled: InfraUpResult = {
  environment: 'local',
  targets: [],
  resources: [],
  outputs: [],
  ledger,
};

describe('Studio Infrastructure Up', () => {
  test('regenerates and reconciles through the provider-neutral project manager boundary', async () => {
    const calls: string[] = [];
    const result = await upProjectInfrastructure({
      projectId: 'project-one',
      workspaceRoot: '/workspace',
      projectManager: {
        regenerateInfrastructure: (projectId) => {
          calls.push(`regenerate:${projectId}`);
          return Promise.resolve(regenerated);
        },
        getProjectManifest: (projectId) => {
          calls.push(`manifest:${projectId}`);
          return Promise.resolve(manifest);
        },
        upInfrastructure: (projectId) => {
          calls.push(`up:${projectId}`);
          return Promise.resolve(reconciled);
        },
      },
    });

    expect(result).toEqual({
      runtime: 'minikube',
      regenerated,
      reconciled,
      trustedOAuth: { deferred: false },
    });
    expect(calls).toEqual([
      'regenerate:project-one',
      'manifest:project-one',
      'manifest:project-one',
      'up:project-one',
    ]);
  });
});
